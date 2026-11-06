import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import nodemailer from 'npm:nodemailer@10.3.1';
import { createAccountHandler } from './handler.js';
import { sendSmtpEmail } from './smtp.js';

Deno.serve(createAccountHandler({
  createClient,
  env: (name: string) => Deno.env.get(name),
  sendEmail: (
    configuration: Parameters<typeof sendSmtpEmail>[1],
    message: Parameters<typeof sendSmtpEmail>[2],
  ) => sendSmtpEmail(nodemailer.createTransport, configuration, message),
}));
