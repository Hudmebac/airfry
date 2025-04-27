'use server';

/**
 * @fileOverview This file contains the Genkit flow for identifying food items from an image.
 *
 * - identifyFood - The main function to identify food and provide cooking instructions.
 * - IdentifyFoodInput - The input type for the identifyFood function.
 * - IdentifyFoodOutput - The output type for the identifyFood function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const IdentifyFoodInputSchema = z.object({
  photoUrl: z.string().describe('The URL of the food photo.'),
});
export type IdentifyFoodInput = z.infer<typeof IdentifyFoodInputSchema>;

const IdentifyFoodOutputSchema = z.object({
  foodName: z.string().describe('The identified name of the food item.'),
  cookingTimeMinutes: z.number().describe('The cooking time **strictly in minutes as a number** (e.g., 15).'),
  cookingTemperatureCelsius: z.string().describe('The cooking temperature in Celsius (e.g., "180").'),
  calorieEstimate: z.number().optional().describe('An estimated calorie count for a typical serving **as a number**.'),
  menuSuggestions: z.array(z.string()).optional().describe('A list of 2-3 suggested menu items or side dishes that pair well with the food.'),
  drinkSuggestion: z.string().optional().describe('A suggested drink pairing for the food item.'),
});
export type IdentifyFoodOutput = z.infer<typeof IdentifyFoodOutputSchema>;

export async function identifyFood(input: IdentifyFoodInput): Promise<IdentifyFoodOutput> {
  return identifyFoodFlow(input);
}

const identifyFoodPrompt = ai.definePrompt({
  name: 'identifyFoodPrompt',
  input: {
    schema: z.object({
      photoUrl: z.string().describe('The URL of the food photo.'),
    }),
  },
  output: {
    schema: IdentifyFoodOutputSchema,
  },
  prompt: `You are an expert chef specializing in air fryer cooking. You provide helpful suggestions for meals.

You will identify the food item in the photo. Then provide:
1.  Air fryer cooking instructions: cooking time **strictly in minutes as a number** and temperature in Celsius.
2.  An estimated calorie count **as a number** for a typical serving.
3.  A list of 2-3 suggested menu items or side dishes that pair well.
4.  A suggested drink pairing.

Use the following as the primary source of information about the food.

Photo: {{media url=photoUrl}}

Respond ONLY with the structured data matching the output schema. Ensure cookingTimeMinutes and calorieEstimate are numbers.
`,
});

const identifyFoodFlow = ai.defineFlow<
  typeof IdentifyFoodInputSchema,
  typeof IdentifyFoodOutputSchema
>({
  name: 'identifyFoodFlow',
  inputSchema: IdentifyFoodInputSchema,
  outputSchema: IdentifyFoodOutputSchema,
}, async input => {
  const {output} = await identifyFoodPrompt(input);
  return output!;
});
