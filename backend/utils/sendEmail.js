const https = require('https');

const sendOTP = async (to, otp) => {
  const data = JSON.stringify({
    sender: { name: 'Samsung Lab Attendance', email: process.env.BREVO_SENDER },
    to: [{ email: to }],
    subject: 'Your OTP - Samsung Lab Attendance',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; background: #111; border-radius: 12px; color: #fff;">
        <h2 style="color: #1488fc; margin-bottom: 10px;">Samsung Lab</h2>
        <p style="color: #aaa;">Your OTP for password reset:</p>
        <div style="background: #1a1a1a; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #fff;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 12px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Brevo API error: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

module.exports = { sendOTP };
