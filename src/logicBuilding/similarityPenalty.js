// Code similarity penalty logic
// Given an array of submissions, penalize similar codes
import stringSimilarity from 'string-similarity';

export function applySimilarityPenalty(submissions) {
  // submissions: [{user, code, score}]
  const threshold = 0.95; // similarity threshold
  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const sim = stringSimilarity.compareTwoStrings(submissions[i].code, submissions[j].code);
      if (sim > threshold) {
        // Penalize both
        if (submissions[i].score < 200) submissions[i].score = 0;
        else submissions[i].score -= 200;
        if (submissions[j].score < 200) submissions[j].score = 0;
        else submissions[j].score -= 200;
      }
    }
  }
  return submissions;
}
