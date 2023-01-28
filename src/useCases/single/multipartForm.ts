import { FastifyRequest, FastifyReply } from 'fastify';
import { getPrediction } from '../../getPrediction.js';
import { FromSchema } from 'json-schema-to-ts';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';

export const singleMultipartFormBodySchema = {
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: {
        $ref: '#mySharedSchema',
      },
    },
  },
  required: ['content'],
} as const;

type BodyEntry = {
  data: Buffer;
  filename: string;
  encoding: string;
  mimetype: string;
  limit: false;
};

export async function SingleMultipartForm(
  request: FastifyRequest<{
    Body: FromSchema<typeof singleMultipartFormBodySchema>;
  }>,
  reply: FastifyReply
) {
  const input = request.body.content[0] as BodyEntry;

  const convert = async (img: Buffer) => {
    // Decoded image in UInt8 Byte array
    const image = await sharp(img)
      .raw()
      .toBuffer();

    const metadata = await sharp(img).metadata();

    const numChannels = 3;
    const numPixels = metadata.width * metadata.height;
    const values = new Int32Array(numPixels * numChannels);

    for (let i = 0; i < numPixels; i++)
      for (let c = 0; c < numChannels; ++c)
        values[i * numChannels + c] = image[i * 4 + c];

    return tf.tensor3d(
      values,
      [metadata.height, metadata.width, numChannels],
      'int32'
    );
  };

  const image = await convert(input.data);

  return reply.send({
    prediction: await getPrediction(image),
  });
}
