import test from 'node:test';
import assert from 'node:assert/strict';

import { dimensions } from '../dist/dimensions.js';
import { questions } from '../dist/questions.js';
import { tiers } from '../dist/tiers.js';

const questionMaxScore = (question) =>
  Math.max(...Object.keys(question.rubric).map((score) => Number(score)));

test('question ids are unique and dimension references are valid', () => {
  const validDimensionIds = new Set(dimensions.map((dimension) => dimension.id));
  const questionIds = new Set();

  for (const question of questions) {
    assert.ok(!questionIds.has(question.id), `duplicate question id: ${question.id}`);
    questionIds.add(question.id);
    assert.ok(
      validDimensionIds.has(question.dimensionId),
      `unknown dimension id on ${question.id}: ${question.dimensionId}`,
    );
  }
});

test('dimension aggregates match the question bank', () => {
  const questionsByDimension = new Map(
    dimensions.map((dimension) => [dimension.id, []]),
  );

  for (const question of questions) {
    questionsByDimension.get(question.dimensionId).push(question);
  }

  let totalQuestionCount = 0;
  let totalMaxScore = 0;

  for (const dimension of dimensions) {
    const dimensionQuestions = questionsByDimension.get(dimension.id);
    const computedMaxScore = dimensionQuestions.reduce(
      (sum, question) => sum + questionMaxScore(question),
      0,
    );

    assert.equal(
      dimensionQuestions.length,
      dimension.questionCount,
      `${dimension.id} questionCount does not match questions.ts`,
    );
    assert.equal(
      computedMaxScore,
      dimension.maxScore,
      `${dimension.id} maxScore does not match questions.ts`,
    );

    totalQuestionCount += dimension.questionCount;
    totalMaxScore += dimension.maxScore;
  }

  assert.equal(totalQuestionCount, questions.length, 'dimension question counts do not sum to all questions');
  assert.equal(
    totalMaxScore,
    questions.reduce((sum, question) => sum + questionMaxScore(question), 0),
    'dimension max scores do not sum to the question bank max score',
  );
});

test('tiers cover the full score range without gaps or overlap', () => {
  const sortedTiers = [...tiers].sort((left, right) => left.minScore - right.minScore);
  const maxPossibleScore = questions.reduce(
    (sum, question) => sum + questionMaxScore(question),
    0,
  );

  assert.equal(sortedTiers[0]?.minScore, 0, 'tiers must start at score 0');
  assert.equal(
    sortedTiers.at(-1)?.maxScore,
    maxPossibleScore,
    'tiers must end at the maximum possible score',
  );

  for (let index = 1; index < sortedTiers.length; index += 1) {
    const previousTier = sortedTiers[index - 1];
    const currentTier = sortedTiers[index];

    assert.equal(
      currentTier.minScore,
      previousTier.maxScore + 1,
      `tiers ${previousTier.label} and ${currentTier.label} are not contiguous`,
    );
  }
});
