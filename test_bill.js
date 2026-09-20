const http = require('http');

function login(email, password) {
  return new Promise((resolve) => {
    const postData = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const r = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      resolve(res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '');
    });
    r.write(postData);
    r.end();
  });
}

function req(path, cookies = '') {
  return new Promise((resolve) => {
    const r = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: { 'Cookie': cookies }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    r.on('error', (e) => resolve({ status: 500, error: e.message }));
    r.end();
  });
}

const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/billing_system');
  const Consumer = mongoose.model('Consumer', new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId }));
  const User = mongoose.model('User', new mongoose.Schema({ email: String }));
  const user = await User.findOne({ email: 'consumer1@billing.local' });
  const consumer = await Consumer.findOne({ userId: user._id });
  
  const Bill = mongoose.model('Bill', new mongoose.Schema({ consumerId: mongoose.Schema.Types.ObjectId }));
  const bill = await Bill.findOne({ consumerId: consumer._id });
  
  const cookie = await login('consumer1@billing.local', 'consumer123');
  const res = await req('/consumer/bills/' + bill._id.toString(), cookie);
  console.log('Status:', res.status);
  if (res.status === 500) console.log(res.data.substring(0, 500));
  
  mongoose.disconnect();
}
run();
