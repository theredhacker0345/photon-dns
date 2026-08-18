/**
 * Pocket Agent Host - Appetize.io Cloud Testing Helper
 * Uploads an APK to Appetize.io and returns the live web player URL.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const token = process.env.APPETIZE_TOKEN;
const releaseOutputDirectory = path.join('android', 'app', 'build', 'outputs', 'apk', 'release');
const defaultApkPath = path.join(releaseOutputDirectory, 'app-release.apk');
const apkPath = process.argv[2] || defaultApkPath;

if (!token) {
  console.error('Error: APPETIZE_TOKEN environment variable is required.');
  console.error('Usage: APPETIZE_TOKEN=your_token node scripts/upload-to-appetize.mjs [path_to_apk]');
  process.exit(1);
}

if (!apkPath || !fs.existsSync(apkPath)) {
  console.error(`Error: signed APK not found at ${apkPath}`);
  console.error('Build with the opt-in POCKET_HERMES_RELEASE_* signing inputs before Appetize.io testing.');
  process.exit(1);
}

if (path.basename(apkPath).includes('-unsigned')) {
  console.error('Error: refusing to upload an unsigned APK. Appetize.io requires an install certificate.');
  process.exit(1);
}

console.log(`Uploading ${apkPath} to Appetize.io...`);

const stats = fs.statSync(apkPath);
const boundary = '----AppetizeBoundary' + Math.random().toString(36).substring(2);
const platformField = Buffer.from(
  `--${boundary}\r\n` +
  'Content-Disposition: form-data; name="platform"\r\n\r\n' +
  'android\r\n',
);
const fileTypeField = Buffer.from(
  `--${boundary}\r\n` +
  'Content-Disposition: form-data; name="fileType"\r\n\r\n' +
  'apk\r\n',
);
const fileHeader = Buffer.from(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="${path.basename(apkPath)}"\r\n` +
  'Content-Type: application/vnd.android.package-archive\r\n\r\n',
);
const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

const options = {
  hostname: 'api.appetize.io',
  path: '/v1/apps',
  method: 'POST',
  headers: {
    'X-API-KEY': token,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': platformField.length + fileTypeField.length + fileHeader.length + stats.size + footer.length,
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const json = JSON.parse(data);
        console.log('\nApp successfully uploaded to Appetize.io!');
        console.log(`Public Key: ${json.publicKey}`);
        console.log(`Platform: ${json.platform ?? 'android'}`);
        console.log(`View App URL: ${json.appUrl ?? `https://appetize.io/app/${json.publicKey}`}`);
        console.log(`Embed Web Player: https://appetize.io/embed/${json.publicKey}`);
      } catch (e) {
        console.log('Response:', data);
      }
    } else {
      console.error(`Upload failed with status code ${res.statusCode}:`, data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Network error during upload:', error);
  process.exit(1);
});

const fileStream = fs.createReadStream(apkPath);

req.write(platformField);
req.write(fileTypeField);
req.write(fileHeader);
fileStream.pipe(req, { end: false });
fileStream.on('end', () => {
  req.write(footer);
  req.end();
});
