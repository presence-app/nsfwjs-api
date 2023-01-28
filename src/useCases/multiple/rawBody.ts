import { FastifyRequest, FastifyReply } from 'fastify';
import { getPrediction } from '../../getPrediction.js';
import { FromSchema } from 'json-schema-to-ts';
import sharp from 'sharp';

export const rawFormBodySchema = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['sources'],
} as const;

type BodyEntry = {
  sources: string[];
};

export async function rawBodyForm(
  request: FastifyRequest<{
    Body: FromSchema<typeof rawFormBodySchema>;
  }>,
  reply: FastifyReply
) {
  const { sources } = request.body as BodyEntry;

  const images = await Promise.all(
    sources.map(async (url) => {
      const metadata = await sharp(url).metadata();
      const image = await sharp(url)
        .raw()
        .toBuffer()
        .then((data: Buffer) => {
          return {
            data: new Int32Array(data),
            width: metadata.width,
            height: metadata.height,
          };
        });
      return image;
    })
  );

  const predictions = await Promise.all(
    images.map(async (image) => getPrediction(image))
  );

  return reply.send({ predictions });
}
