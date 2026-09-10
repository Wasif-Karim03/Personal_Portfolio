import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

/**
 * Case studies behind the project index (FIG. 14).
 *
 * The shape follows the case study template in docs/storyboard.md: the problem,
 * the constraints, the system, what broke, how it was fixed, the result, and
 * process media. Body prose carries those sections; frontmatter carries what the
 * index and ordering need.
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** One line for the project index card. */
    summary: z.string(),
    /** Lower sorts first. Robotics leads, per the storyboard. */
    order: z.number(),
    year: z.string(),
    role: z.string(),
    stack: z.array(z.string()).default([]),
    /** In-progress projects are framed as a live build log, not a finished case study. */
    inProgress: z.boolean().default(false),
    /**
     * Draft pages are written but held back from the index. Every project ships
     * as a draft until Wasif signs off on the copy and media.
     */
    draft: z.boolean().default(true),
  }),
});

export const collections = { projects };
