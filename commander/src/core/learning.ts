import { z } from 'zod';

export const datasetSampleSchema = z.object({
  timestamp: z.number().int().nonnegative(),
  target: z.union([z.literal('simulation'), z.literal('real')]),
  positions: z.array(z.number().int()).length(6),
  velocities: z.array(z.number()).length(6),
  sensors: z.array(z.number().int()).length(8).nullable(),
  lastCommand: z.string(),
  cameraFrame: z.string().nullable()
});

export const datasetManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  label: z.string().max(200),
  createdAt: z.string().datetime(),
  samplePeriodMs: z.number().int().min(20).max(10_000),
  split: z.object({ train: z.number().min(0).max(1), validation: z.number().min(0).max(1), test: z.number().min(0).max(1) }),
  samples: z.array(datasetSampleSchema)
}).superRefine((manifest, context) => {
  const total = manifest.split.train + manifest.split.validation + manifest.split.test;
  if (Math.abs(total - 1) > 0.0001) context.addIssue({ code: z.ZodIssueCode.custom, path: ['split'], message: 'Dataset split must total 100%' });
});

export const modelMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(40),
  datasetId: z.string().min(1),
  framework: z.string().max(80),
  task: z.string().max(120),
  createdAt: z.string().datetime(),
  evaluation: z.string().max(500),
  deployment: z.union([z.literal('not-tested'), z.literal('simulation-approved'), z.literal('real-blocked')])
});

export type DatasetManifest = z.infer<typeof datasetManifestSchema>;
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

