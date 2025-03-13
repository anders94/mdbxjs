declare module 'mdbx' {
  export enum EnvFlags {
    NOSUBDIR = 0x4000,
    NOSYNC = 0x10000,
    RDONLY = 0x20000,
    NOMETASYNC = 0x40000,
    WRITEMAP = 0x80000,
    MAPASYNC = 0x100000,
    NOTLS = 0x200000,
    NORDAHEAD = 0x800000,
    NOMEMINIT = 0x1000000,
    COALESCE = 0x2000000,
    LIFORECLAIM = 0x4000000
  }

  export enum DatabaseFlags {
    REVERSEKEY = 0x02,
    DUPSORT = 0x04,
    INTEGERKEY = 0x08,
    DUPFIXED = 0x10,
    INTEGERDUP = 0x20,
    REVERSEDUP = 0x40,
    CREATE = 0x40000
  }

  export enum WriteFlags {
    NOOVERWRITE = 0x10,
    NODUPDATA = 0x20,
    CURRENT = 0x40,
    RESERVE = 0x10000,
    APPEND = 0x20000,
    APPENDDUP = 0x40000,
    MULTIPLE = 0x80000
  }

  export enum TransactionMode {
    READONLY,
    READWRITE
  }

  export enum SeekOperation {
    FIRST,
    FIRST_DUP,
    GET_BOTH,
    GET_BOTH_RANGE,
    GET_CURRENT,
    GET_MULTIPLE,
    LAST,
    LAST_DUP,
    NEXT,
    NEXT_DUP,
    NEXT_MULTIPLE,
    NEXT_NODUP,
    PREV,
    PREV_DUP,
    PREV_NODUP,
    SET,
    SET_KEY,
    SET_RANGE
  }

  export type Key = Buffer | string | number;
  export type Value = Buffer | string | number | object;
  export type KeyValue = { key: Buffer, value: Buffer };

  export interface EnvOptions {
    path?: string;
    maxDbs?: number;
    mapSize?: number;
    maxReaders?: number;
    flags?: EnvFlags | number;
  }

  export interface TransactionOptions {
    mode?: TransactionMode;
    parent?: Transaction;
  }

  export interface DatabaseOptions {
    name?: string;
    create?: boolean;
    flags?: DatabaseFlags | number;
  }

  export class Environment {
    constructor(options?: EnvOptions);
    open(options?: EnvOptions): void;
    close(): void;
    beginTransaction(options?: TransactionOptions): Transaction;
    openDatabase(options?: DatabaseOptions): Database;
    sync(force?: boolean): void;
    stat(): { psize: number, depth: number, branch_pages: number, leaf_pages: number, overflow_pages: number, entries: number };
    info(): { mapSize: number, lastPageNumber: number, lastTransactionId: number, maxReaders: number, numReaders: number };
    copy(path: string): void;
    setMapSize(size: number): void;
  }

  export class Transaction {
    constructor(env: Environment, options?: TransactionOptions);
    abort(): void;
    commit(): void;
    renew(): void;
    reset(): void;
    get(dbi: Database, key: Key): Buffer | null;
    put(dbi: Database, key: Key, value: Value, flags?: WriteFlags | number): void;
    del(dbi: Database, key: Key, value?: Value): boolean;
    openCursor(dbi: Database): Cursor;
  }

  export class Database {
    constructor(env: Environment, options?: DatabaseOptions);
    close(): void;
    drop(): void;
    stat(txn: Transaction): { entries: number, depth: number, branch_pages: number, leaf_pages: number, overflow_pages: number, page_size: number };
  }

  export class Cursor {
    constructor(txn: Transaction, dbi: Database);
    close(): void;
    del(flags?: number): void;
    get(op: SeekOperation, key?: Key, value?: Value): KeyValue | null;
    put(key: Key, value: Value, flags?: WriteFlags | number): void;
    count(): number;
  }

  // Simplified interface for beginners
  export function open(path: string, options?: Partial<EnvOptions>): Environment;
  export function collection(env: Environment, name?: string, options?: Partial<DatabaseOptions>): {
    get(key: Key, txnOptions?: TransactionOptions): any;
    put(key: Key, value: Value, txnOptions?: TransactionOptions): void;
    del(key: Key, txnOptions?: TransactionOptions): boolean;
    find(options: { gt?: Key, gte?: Key, lt?: Key, lte?: Key, limit?: number, reverse?: boolean }): Array<KeyValue>;
    count(txnOptions?: TransactionOptions): number;
    drop(): void;
    clear(): void;
  };
}