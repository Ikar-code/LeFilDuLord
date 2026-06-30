/**
 * Copyright (c) 2026 Lucas Rajany
 * Licensed under the MIT License.
 * See LICENSE file for details.
 */   

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Liste des clés Gemini disponibles, dans l'ordre d'utilisation.
// GEMINI_API_KEY est essayée en premier, puis GEMINI_API_KEY_2 si le quota
// journalier de la première est épuisé sur le modèle demandé.
export const GEMINI_API_KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean);

// Conservé pour compatibilité avec du code existant qui importerait directement genAI
// (utilise la 1ère clé uniquement, sans bascule automatique).
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEYS[0]);

// Clé Groq (utilisée dans step3_writeArticle.js et step4_scoreArticle.js)
export const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Clés des banques d'images gratuites (utilisées dans step5b_findImage.js)
export const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
export const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
export const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
