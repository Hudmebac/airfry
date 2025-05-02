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
  calorieEstimate: z
    .number()
    .optional()
    .describe('An estimated calorie count for a typical serving as a number.'),
  menuSuggestions: z
    .array(z.string())
    .optional()
    .describe('A list of 2-3 suggested menu items or side dishes that pair well with the food.'),
  drinkSuggestion: z
    .string()
    .optional()
    .describe('A suggested drink pairing for the food item.'),
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
    schema: GenerateCookingInstructionsOutputSchema,
  },
  prompt: `You are an expert air fryer chef. For the following food item, provide:
1. Cooking time in minutes (as a number)
2. Cooking temperature in Celsius
3. An estimated calorie count for a typical serving (as a number)
4. 2-3 menu suggestions or side dishes that pair well
5. A suggested drink pairing

Food Item: {{{foodName}}}

Respond ONLY with the structured data matching the output schema. Ensure cookingTime and calorieEstimate are numbers.`
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
