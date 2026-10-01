const { z } = require('zod');

const cardSchema = z.object({
  name: z.string().trim().min(1, 'Card name is required').max(200),
  setCode: z.string().trim().min(1, 'Set code is required').max(12).transform((value) => value.toUpperCase()),
  setName: z.string().trim().min(1, 'Set name is required').max(200),
  collectorNumber: z.string().trim().min(1, 'Collector number is required').max(32),
  finish: z.enum(['nonfoil', 'foil', 'etched'], { error: 'Finish must be nonfoil, foil, or etched' }),
  condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG'], { error: 'Condition must be NM, LP, MP, HP, or DMG' }),
  quantity: z.coerce.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(100000),
  scryfallId: z.string().trim().uuid('Scryfall ID must be a UUID')
});

function validateCard(input) {
  const result = cardSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({ field: issue.path[0] || 'card', message: issue.message }))
  };
}

module.exports = { cardSchema, validateCard };
