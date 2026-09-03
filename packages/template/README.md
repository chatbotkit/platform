```
    .d8888b.  888888b.   888    d8P
   d88P  Y88b 888  "88b  888   d8P
   888    888 888  .88P  888  d8P
   888        8888888K.  888d88K
   888        888  "Y88b 8888888b
   888    888 888    888 888  Y88b
   Y88b  d88P 888   d88P 888   Y88b
    "Y8888P"  8888888P"  888    Y88b
```

# Template Package

Clean conditional templating with line-aware content removal.

Provides utility functions for dealing with templates through tagged template literals and conditional content rendering.

## Features

- `template` tagged template literal processor
- `when(condition, content?)` function for conditional content
- Automatic whitespace dedenting by shortest common prefix
- Removes entire lines when `when(false)` with no content
- Clean, predictable output

## Usage

```javascript
import { template, when } from '@chatbotkit-dev/template'

const output = template`
  This is a simple bot that has a couple of things in common.
  * use the most recent version of the library ${when(true)} 
  * use the previous version of the library ${when(false)} 
  ${when(true, 'Make sure to use this other thing which works!')}
`
```

## Whitespace Handling

The template function automatically removes common leading whitespace (dedenting) to improve developer experience:

```javascript
const setup = template`
    First line
    Second line
      3rd-indented line
`

// Result:
// "First line\nSecond line\n  3rd-indented line"
```

The function finds the shortest whitespace prefix among all non-empty lines and removes it from each line, preserving relative indentation.
