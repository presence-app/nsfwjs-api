import { FastifyRequest, FastifyReply } from 'fastify';
import { getPrediction } from '../../getPrediction.js';
import { FromSchema } from 'json-schema-to-ts';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';

export const multipleMultipartFormBodySchema = {
  type: 'object',
  properties: {
    contents: {
      type: 'array',
      items: {
        $ref: '#mySharedSchema',
      },
    },
  },
  required: ['contents'],
} as const;

type BodyEntry = {
  data: Buffer;
  filename: string;
  encoding: string;
  mimetype: string;
  limit: false;
};

export async function MultipleMultipartForm(
  request: FastifyRequest<{
    Body: FromSchema<typeof multipleMultipartFormBodySchema>;
  }>,
  reply: FastifyReply
) {
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

  let imagesData = request.body.contents as BodyEntry[];

  const images = await Promise.all(
    imagesData.map(async (file) => {
      const image = await convert(file.data);
      return image;
    })
  );

  const predictions = await Promise.all(
    images.map(async (image) => {
      return getPrediction(image);
    })
  );

  return reply.send({ predictions });
}
