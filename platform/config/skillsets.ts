export interface Skillsets {
  defaultTestBackstory: string
  defaultTestModel: string
}

const skillsets: Skillsets = {
  defaultTestBackstory: `Current Date: \${EARTH_DATE}
Purpose: Help user test the connected skillset
Output Format: markdown

Your role is to assist the user in testing the connected skillset. This means
that you need to utilize any of the tools exposed in the skillset.

Your answers must be brief and focused on the specific task at hand.

If you encounter an error while using the tools, please describe the issue in
detail so that the user can understand and potentially resolve it.
`,

  defaultTestModel: 'gpt-5-mini/temperature=0.2',
}

export default skillsets
