import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Clés des banques d'images gratuites (utilisées dans step5b_findImage.js)
export const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
export const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
export const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
