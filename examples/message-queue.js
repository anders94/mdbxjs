'use strict';

const mdbx = require('../lib');
const { EnvFlags, WriteFlags, SeekOperation } = mdbx;

/**
 * A simple message queue implementation using mdbx.
 * 
 * This example demonstrates how to use mdbx to build a durable message queue
 * with support for multiple queues, guaranteed message delivery, and
 * dead-letter handling.
 */
class MessageQueue {
  constructor(options = {}) {
    const defaults = {
      path: './mdbx-queue',
      mapSize: 100 * 1024 * 1024, // 100MB
      syncMode: 'normal' // 'normal', 'fast', or 'safe'
    };
    
    const opts = { ...defaults, ...options };
    
    // Determine sync flags based on syncMode
    let flags = 0;
    if (opts.syncMode === 'fast') {
      flags |= EnvFlags.NOSYNC;
    } else if (opts.syncMode === 'normal') {
      flags |= EnvFlags.NOMETASYNC;
    }
    
    // Open environment
    this.env = new mdbx.Environment();
    this.env.open({
      path: opts.path,
      mapSize: opts.mapSize,
      flags
    });
    
    // Open databases
    this.queuesDb = this.env.openDatabase({ name: 'queues', create: true });
    this.messagesDb = this.env.openDatabase({ name: 'messages', create: true });
    this.dlqDb = this.env.openDatabase({ name: 'deadletter', create: true });
    
    console.log(`MessageQueue initialized at ${opts.path}`);
  }
  
  /**
   * Close the message queue
   */
  close() {
    this.env.close();
  }
  
  /**
   * Create a new queue
   * @param {string} queueName - The name of the queue
   */
  createQueue(queueName) {
    if (!queueName) {
      throw new Error('Queue name is required');
    }
    
    const txn = this.env.beginTransaction();
    try {
      // Check if queue already exists
      const existingQueue = txn.get(this.queuesDb, queueName);
      if (existingQueue) {
        txn.abort();
        throw new Error(`Queue ${queueName} already exists`);
      }
      
      // Create queue entry
      const queue = {
        name: queueName,
        created: Date.now(),
        messageCount: 0,
        lastMessageId: 0
      };
      
      txn.put(this.queuesDb, queueName, JSON.stringify(queue));
      txn.commit();
      
      console.log(`Queue '${queueName}' created successfully`);
      return queue;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * Get info about a queue
   * @param {string} queueName - The name of the queue
   * @returns {Object} Queue info
   */
  getQueueInfo(queueName) {
    const txn = this.env.beginTransaction({ mode: 0 }); // READONLY
    try {
      const queueBuffer = txn.get(this.queuesDb, queueName);
      if (!queueBuffer) {
        txn.abort();
        throw new Error(`Queue ${queueName} does not exist`);
      }
      
      const queue = JSON.parse(queueBuffer.toString());
      txn.abort();
      return queue;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * Get a list of all queues
   * @returns {Array} List of queue info objects
   */
  listQueues() {
    const queues = [];
    const txn = this.env.beginTransaction({ mode: 0 }); // READONLY
    try {
      const cursor = txn.openCursor(this.queuesDb);
      let entry = cursor.get(SeekOperation.FIRST);
      
      while (entry) {
        const queueInfo = JSON.parse(entry.value.toString());
        queues.push(queueInfo);
        entry = cursor.get(SeekOperation.NEXT);
      }
      
      cursor.close();
      txn.abort();
      return queues;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * Send a message to a queue
   * @param {string} queueName - The queue to send to
   * @param {Object} messageData - The message data
   * @returns {string} Message ID
   */
  sendMessage(queueName, messageData) {
    const txn = this.env.beginTransaction();
    try {
      // Get queue info
      const queueBuffer = txn.get(this.queuesDb, queueName);
      if (!queueBuffer) {
        txn.abort();
        throw new Error(`Queue ${queueName} does not exist`);
      }
      
      const queue = JSON.parse(queueBuffer.toString());
      
      // Create new message
      const messageId = `${queueName}:${++queue.lastMessageId}`;
      const message = {
        id: messageId,
        queueName,
        data: messageData,
        timestamp: Date.now(),
        attempts: 0,
        status: 'pending'
      };
      
      // Update queue info
      queue.messageCount++;
      
      // Store message and updated queue info
      txn.put(this.messagesDb, messageId, JSON.stringify(message));
      txn.put(this.queuesDb, queueName, JSON.stringify(queue));
      
      txn.commit();
      console.log(`Message sent to queue '${queueName}', id: ${messageId}`);
      return messageId;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * Receive a message from a queue
   * @param {string} queueName - The queue to receive from
   * @param {Object} options - Receive options
   * @returns {Object|null} Message or null if none available
   */
  receiveMessage(queueName, options = {}) {
    const defaults = {
      visibilityTimeout: 30000 // 30 seconds
    };
    
    const opts = { ...defaults, ...options };
    
    const txn = this.env.beginTransaction();
    try {
      // Find a message for this queue
      const cursor = txn.openCursor(this.messagesDb);
      let entry = cursor.get(SeekOperation.SET_RANGE, queueName + ':');
      
      while (entry) {
        const key = entry.key.toString();
        // Check if the key still belongs to this queue
        if (!key.startsWith(queueName + ':')) {
          cursor.close();
          txn.abort();
          return null; // No more messages for this queue
        }
        
        const message = JSON.parse(entry.value.toString());
        
        // Only process pending messages
        if (message.status === 'pending') {
          // Update message status
          message.status = 'processing';
          message.attempts++;
          message.visibleAfter = Date.now() + opts.visibilityTimeout;
          
          // Update the message in the database
          txn.put(this.messagesDb, key, JSON.stringify(message));
          
          cursor.close();
          txn.commit();
          
          // Return only the message data and receipt info
          return {
            messageId: message.id,
            data: message.data,
            receiptHandle: message.id,
            attempts: message.attempts
          };
        }
        
        // Try next message
        entry = cursor.get(SeekOperation.NEXT);
      }
      
      cursor.close();
      txn.abort();
      return null; // No messages available
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * Delete a message after it has been processed
   * @param {string} receiptHandle - The receipt handle from receiveMessage
   * @returns {boolean} True if deleted, false if not found
   */
  deleteMessage(receiptHandle) {
    const txn = this.env.beginTransaction();
    try {
      // Get the message
      const messageBuffer = txn.get(this.messagesDb, receiptHandle);
      if (!messageBuffer) {
        txn.abort();
        return false;
      }
      
      const message = JSON.parse(messageBuffer.toString());
      
      // Get queue info to decrement message count
      const queueBuffer = txn.get(this.queuesDb, message.queueName);
      if (queueBuffer) {
        const queue = JSON.parse(queueBuffer.toString());
        queue.messageCount = Math.max(0, queue.messageCount - 1);
        txn.put(this.queuesDb, message.queueName, JSON.stringify(queue));
      }
      
      // Delete the message
      txn.del(this.messagesDb, receiptHandle);
      
      txn.commit();
      console.log(`Message ${receiptHandle} deleted successfully`);
      return true;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * Move failed messages to the dead-letter queue
   * @param {string} receiptHandle - The receipt handle from receiveMessage
   * @param {string} reason - The reason for moving to DLQ
   * @returns {boolean} True if moved, false if not found
   */
  moveToDeadLetter(receiptHandle, reason = 'Processing failed') {
    const txn = this.env.beginTransaction();
    try {
      // Get the message
      const messageBuffer = txn.get(this.messagesDb, receiptHandle);
      if (!messageBuffer) {
        txn.abort();
        return false;
      }
      
      const message = JSON.parse(messageBuffer.toString());
      
      // Update message for DLQ
      message.status = 'dead-letter';
      message.movedToDlq = Date.now();
      message.dlqReason = reason;
      
      // Store in DLQ and delete from original queue
      txn.put(this.dlqDb, receiptHandle, JSON.stringify(message));
      txn.del(this.messagesDb, receiptHandle);
      
      // Update queue message count
      const queueBuffer = txn.get(this.queuesDb, message.queueName);
      if (queueBuffer) {
        const queue = JSON.parse(queueBuffer.toString());
        queue.messageCount = Math.max(0, queue.messageCount - 1);
        txn.put(this.queuesDb, message.queueName, JSON.stringify(queue));
      }
      
      txn.commit();
      console.log(`Message ${receiptHandle} moved to dead-letter queue`);
      return true;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
  
  /**
   * List messages in the dead-letter queue
   * @param {string} queueName - Optional queue name filter
   * @returns {Array} List of dead-letter messages
   */
  listDeadLetterMessages(queueName = null) {
    const messages = [];
    const txn = this.env.beginTransaction({ mode: 0 }); // READONLY
    try {
      const cursor = txn.openCursor(this.dlqDb);
      let entry = cursor.get(SeekOperation.FIRST);
      
      while (entry) {
        const message = JSON.parse(entry.value.toString());
        
        // Apply queue filter if provided
        if (!queueName || message.queueName === queueName) {
          messages.push(message);
        }
        
        entry = cursor.get(SeekOperation.NEXT);
      }
      
      cursor.close();
      txn.abort();
      return messages;
    } catch (err) {
      txn.abort();
      throw err;
    }
  }
}

// Example usage
async function runExample() {
  const queue = new MessageQueue({ 
    path: './mdbx-queue-example', 
    syncMode: 'normal'
  });
  
  try {
    // Create queues
    queue.createQueue('orders');
    queue.createQueue('notifications');
    
    // List queues
    console.log('\nQueues:');
    const queues = queue.listQueues();
    queues.forEach(q => console.log(`- ${q.name} (messages: ${q.messageCount})`));
    
    // Send messages
    console.log('\nSending messages...');
    queue.sendMessage('orders', { id: 12345, customer: 'John Doe', amount: 99.99 });
    queue.sendMessage('orders', { id: 12346, customer: 'Jane Smith', amount: 149.99 });
    queue.sendMessage('notifications', { type: 'email', recipient: 'user@example.com', subject: 'Order Confirmation' });
    
    // Process messages (simulating a worker)
    console.log('\nProcessing orders...');
    let orderMessage;
    while ((orderMessage = queue.receiveMessage('orders'))) {
      console.log(`Processing order: ${JSON.stringify(orderMessage.data)}`);
      
      // Simulate processing
      if (orderMessage.data.id === 12345) {
        // Successfully process this message
        console.log('Order processed successfully');
        queue.deleteMessage(orderMessage.receiptHandle);
      } else {
        // Simulate a failure
        console.log('Order processing failed');
        queue.moveToDeadLetter(orderMessage.receiptHandle, 'Payment declined');
      }
    }
    
    // Process notifications
    console.log('\nProcessing notifications...');
    let notificationMessage;
    while ((notificationMessage = queue.receiveMessage('notifications'))) {
      console.log(`Sending notification: ${JSON.stringify(notificationMessage.data)}`);
      
      // Successfully process all notifications
      queue.deleteMessage(notificationMessage.receiptHandle);
    }
    
    // Check dead-letter queue
    console.log('\nMessages in dead-letter queue:');
    const dlqMessages = queue.listDeadLetterMessages();
    dlqMessages.forEach(message => {
      console.log(`- Message ID: ${message.id}`);
      console.log(`  Queue: ${message.queueName}`);
      console.log(`  Reason: ${message.dlqReason}`);
      console.log(`  Data: ${JSON.stringify(message.data)}`);
    });
    
    // Final queue state
    console.log('\nFinal queue states:');
    const finalQueues = queue.listQueues();
    finalQueues.forEach(q => console.log(`- ${q.name} (messages: ${q.messageCount})`));
    
  } finally {
    // Clean up
    queue.close();
    console.log('\nExample completed successfully!');
  }
}

// Run the example
runExample().catch(err => console.error('Example failed:', err));