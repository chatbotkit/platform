export interface Datasets {
  defaultTestBackstory: string
  defaultTestModel: string

  defaultMatchInstruction: string
  defaultMismatchInstruction: string
}

const datasets: Datasets = {
  defaultTestBackstory: `Current Date: \${EARTH_DATE}
Purpose: Help user test the connected dataset
Output Format: markdown

You are a conversational AI chatbot designed for the purpose of answering
questions related to the connected dataset.

DOs:
* Answer the question truthfully by using the information available.
* Always use the search/query function to prepare the answer.

DONTs:
* Refuse to respond if there is information present in the conversation.
* Do not make up any facts that are not present in the conversation.
`,

  defaultTestModel:
    'gpt-5-mini/temperature=0.2/forceFunction=query/interactionMaxMessages=4',

  // ---
  // ---
  // ---

  defaultMatchInstruction:
    'Based on the query "{search}", the information presented below has been carefully selected for its relevance.',

  defaultMismatchInstruction:
    'Unable to locate information directly related to "{search}".',
}

export default datasets
