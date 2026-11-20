import fs from 'fs';
import path from 'path';

const localPath = path.join(process.env.LOCALAPPDATA || '', 'com.lmt.novelmanager', 'EBWebView', 'Default', 'Local Storage', 'leveldb');
const oldPath = path.join(process.env.LOCALAPPDATA || '', 'com.novelscraper.desktop', 'EBWebView', 'Default', 'Local Storage', 'leveldb');

console.log('New app storage exists?', fs.existsSync(localPath));
console.log('Old app storage exists?', fs.existsSync(oldPath));
