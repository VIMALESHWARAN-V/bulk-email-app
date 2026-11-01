import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const emailSchema = new mongoose.Schema({
  subject: { type: String, required: true }, body: { type: String, required: true },
  recipients: [{ type: String, required: true }], status: { type: String, enum: ['sent', 'failed', 'demo'], default: 'sent' },
  error: String, sentAt: { type: Date, default: Date.now }
});
const EmailRecord = mongoose.model('EmailRecord', emailSchema);

const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = smtpReady ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }) : null;

app.get('/api/health', (_req, res) => res.json({ ok: true, smtpReady, database: mongoose.connection.readyState === 1 }));
app.get('/api/emails', async (_req, res) => {
  try { res.json(await EmailRecord.find().sort({ sentAt: -1 }).limit(50).lean()); }
  catch (error) { res.status(500).json({ message: 'Could not load email history.', error: error.message }); }
});

app.post('/api/send', async (req, res) => {
  const { subject, body, recipients } = req.body;
  const cleanRecipients = Array.isArray(recipients) ? [...new Set(recipients.map(String).map(x => x.trim()).filter(Boolean))] : [];
  if (!subject?.trim() || !body?.trim() || !cleanRecipients.length) return res.status(400).json({ message: 'Subject, message, and at least one recipient are required.' });
  const invalid = cleanRecipients.filter(email => !/^\S+@\S+\.\S+$/.test(email));
  if (invalid.length) return res.status(400).json({ message: `Invalid recipient email: ${invalid[0]}` });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected. Start MongoDB or update MONGODB_URI before sending.' });
  let status = smtpReady ? 'sent' : 'demo'; let errorMessage;
  try {
    if (transporter) await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: cleanRecipients.join(','), subject: subject.trim(), text: body.trim(), html: `<div style="white-space:pre-wrap">${body.trim()}</div>` });
    else console.log(`[demo] Would send “${subject.trim()}” to ${cleanRecipients.join(', ')}`);
  } catch (error) { status = 'failed'; errorMessage = error.message; }
  try { const record = await EmailRecord.create({ subject: subject.trim(), body: body.trim(), recipients: cleanRecipients, status, error: errorMessage }); res.status(status === 'failed' ? 502 : 201).json({ message: status === 'demo' ? 'Saved in demo mode. Add SMTP credentials to send for real.' : 'Email sent successfully.', record }); }
  catch (error) { res.status(500).json({ message: 'Mail was processed but could not be saved.', error: error.message }); }
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bulk-mail-studio', { serverSelectionTimeoutMS: 5000 }).then(() => console.log('MongoDB connected')).catch(error => console.warn('MongoDB unavailable; history requires MongoDB.', error.message));
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
