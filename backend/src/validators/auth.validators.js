const { z } = require('zod');
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200)
}).strict();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200).regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number')
}).strict();
module.exports = { loginSchema, changePasswordSchema };
