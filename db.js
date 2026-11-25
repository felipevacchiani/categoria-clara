import {DatabaseSync} from 'node:sqlite';
export function openDatabase(path) {
  const db=new DatabaseSync(path);
  db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admins(user_id TEXT PRIMARY KEY REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS policy_reads(user_id TEXT PRIMARY KEY REFERENCES users(id),version TEXT NOT NULL,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS verified_emails(user_id TEXT PRIMARY KEY REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS email_challenges(user_id TEXT PRIMARY KEY REFERENCES users(id),digest TEXT NOT NULL,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),slug TEXT NOT NULL,version TEXT NOT NULL,cents INTEGER NOT NULL,state TEXT NOT NULL,result TEXT NOT NULL,preference TEXT,created TEXT NOT NULL,policy TEXT NOT NULL,mode TEXT NOT NULL,approved_payment TEXT);
  CREATE TABLE IF NOT EXISTS checkout_attempts(order_id TEXT PRIMARY KEY REFERENCES orders(id),created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),status TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reports(order_id TEXT PRIMARY KEY REFERENCES orders(id),body BLOB NOT NULL,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,slug TEXT NOT NULL,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS portal_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),actividad TEXT NOT NULL,categoria TEXT NOT NULL,updated TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),fecha TEXT NOT NULL,tipo TEXT NOT NULL,cents INTEGER NOT NULL,detail BLOB NOT NULL,dedupe TEXT,created TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS invoices_user ON invoices(user_id,fecha);
  CREATE UNIQUE INDEX IF NOT EXISTS invoices_dedupe ON invoices(user_id,dedupe);
  CREATE TABLE IF NOT EXISTS account_tokens(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),purpose TEXT NOT NULL,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS withdrawals(id TEXT PRIMARY KEY,reference TEXT NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL);
  `);
  const columns=db.prepare('PRAGMA table_info(orders)').all().map(column=>column.name);
  if(!columns.includes('accessed_at')) db.exec('ALTER TABLE orders ADD COLUMN accessed_at TEXT');
  if(!columns.includes('purged_at')) db.exec('ALTER TABLE orders ADD COLUMN purged_at TEXT');
  if(!columns.includes('access_digest')) db.exec('ALTER TABLE orders ADD COLUMN access_digest TEXT');
  if(!columns.includes('access_sealed')) db.exec('ALTER TABLE orders ADD COLUMN access_sealed BLOB');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_access ON orders(access_digest)');
  if(!columns.includes('source')) db.exec('ALTER TABLE orders ADD COLUMN source TEXT');
  const eventColumns=db.prepare('PRAGMA table_info(events)').all().map(column=>column.name);
  if(!eventColumns.includes('source')) db.exec('ALTER TABLE events ADD COLUMN source TEXT');
  if(!eventColumns.includes('channel')) db.exec('ALTER TABLE events ADD COLUMN channel TEXT');
  if(!columns.includes('channel')) db.exec('ALTER TABLE orders ADD COLUMN channel TEXT');
  atomic(db,()=>{
    for(const table of ['orders','events']){
      const update=db.prepare(`UPDATE ${table} SET slug=? WHERE slug=?`);
      update.run('calculo-indemnizacion','indemnizaya');
      update.run('ruta-ciudadania','ciudadania-ya');
    }
  });
  return db;
}
export function atomic(db, handler) {
  db.exec('BEGIN IMMEDIATE');
  try {const result=handler();db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
}
