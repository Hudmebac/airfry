// Use server directive is crucial for server-side functions in Next.js.
'use server';

/**
 * @fileOverview Generates cooking instructions for a given food item.
 *
 * This file defines a Genkit flow that takes a food item name as input and returns
 * cooking times and temperatures in Celsius for air frying.
 *
 * @exports generateCookingInstructions - The main function to generate cooking instructions.
 * @exports GenerateCookingInstructionsInput - The input type for the generateCookingInstructions function.
 * @exports GenerateCookingInstructionsOutput - The return type for the generateCookingInstructions function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Define the input schema for the flow.
const GenerateCookingInstructionsInputSchema = z.object({
  foodName: z.string().describe('The name of the food item to cook.'),
});

export type GenerateCookingInstructionsInput = z.infer<
  typeof GenerateCookingInstructionsInputSchema
>;

// Define the output schema for the flow.
const GenerateCookingInstructionsOutputSchema = z.object({
  cookingTime: z
    .string()
    .describe('The cooking time in minutes for the food item.'),
  cookingTemperatureCelsius: z
    .string()
    .describe('The cooking temperature in Celsius for the food item.'),
});

export type GenerateCookingInstructionsOutput = z.infer<
  typeof GenerateCookingInstructionsOutputSchema
>;

// Exported function to generate cooking instructions.
export async function generateCookingInstructions(
  input: GenerateCookingInstructionsInput
): Promise<GenerateCookingInstructionsOutput> {
  return generateCookingInstructionsFlow(input);
}

// Define the prompt for the flow.
const cookingInstructionsPrompt = ai.definePrompt({
  name: 'cookingInstructionsPrompt',
  input: {
    schema: z.object({
      foodName: z.string().describe('The name of the food item to cook.'),
    }),
  },
  output: {
    schema: z.object({
      cookingTime: z
        .string()
        .describe('The cooking time in minutes for the food item.'),
      cookingTemperatureCelsius: z
        .string()
        .describe('The cooking temperature in Celsius for the food item.'),
    }),
  },
  prompt: `You are an expert air fryer chef. Provide cooking instructions for the following food item:

Food Item: {{{foodName}}}

Provide the cooking time in minutes and the cooking temperature in Celsius.`,
});

// Define the Genkit flow.
const generateCookingInstructionsFlow = ai.defineFlow<
  typeof GenerateCookingInstructionsInputSchema,
  typeof GenerateCookingInstructionsOutputSchema
>(
  {
    name: 'generateCookingInstructionsFlow',
    inputSchema: GenerateCookingInstructionsInputSchema,
    outputSchema: GenerateCookingInstructionsOutputSchema,
  },
  async input => {
    const {output} = await cookingInstructionsPrompt(input);
    return output!;
  }
);
