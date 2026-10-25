import {mkdir,writeFile,readFile,unlink,readdir} from 'node:fs/promises'
import path from 'node:path'
const keyPattern=/^(?:evidence\/[\da-f-]{36}\.jpg|backups\/[\da-f-]{36}\.bccbackup)$/
export function fileStore(pool){
 const hosted=process.env.FILE_STORAGE==='postgres'
 function filename(key){if(!keyPattern.test(key))throw Error('Invalid private file key');const backup=key.startsWith('backups/');return path.resolve(backup?(process.env.BACKUP_DIR||'backups'):(process.env.UPLOAD_DIR||'uploads'),key.split('/')[1])}
 return {
  async write(key,content){filename(key);if(hosted){await pool.query('INSERT INTO private_files(key,content) VALUES($1,$2)',[key,content]);return}const file=filename(key);await mkdir(path.dirname(file),{recursive:true,mode:0o700});await writeFile(file,content,{flag:'wx',mode:0o600})},
  async read(key){filename(key);if(hosted){const r=(await pool.query('SELECT content FROM private_files WHERE key=$1',[key])).rows[0];if(!r)throw Object.assign(Error('File not found'),{code:'ENOENT'});return Buffer.from(r.content)}return readFile(filename(key))},
  async remove(key){filename(key);if(hosted){await pool.query('DELETE FROM private_files WHERE key=$1',[key]);return}await unlink(filename(key))},
  async listBackups(){if(hosted)return (await pool.query("SELECT key,created_at FROM private_files WHERE key LIKE 'backups/%' ORDER BY created_at DESC")).rows.map(r=>({id:r.key.slice(8,-10),created_at:r.created_at}));try{return (await readdir(path.resolve(process.env.BACKUP_DIR||'backups'))).filter(n=>/^[\da-f-]{36}\.bccbackup$/.test(n)).map(n=>({id:n.slice(0,-10)}))}catch(e){if(e.code==='ENOENT')return [];throw e}}
 }
}
