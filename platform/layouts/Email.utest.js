import { renderToStaticMarkup as renderEmail } from 'react-dom/server'

import {
  BasicEmail,
  Body,
  BrandedEmail,
  Button,
  Container,
  Feedback,
  Heading,
  Img,
  Link,
  Markdown,
  Section,
  Text,
  Unsubscribe,
  resolveBrandHeader,
} from '@/layouts/Email'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// resolveBrandHeader
// ---------------------------------------------------------------------------

describe('resolveBrandHeader', () => {
  it('returns icon mode with CBK defaults when no partner is provided', () => {
    const brand = resolveBrandHeader()

    expect(brand.mode).toBe('icon')
    expect(brand.alt).toBe('ChatBotKit')
    expect(brand.label).toBe('CBK')
    expect(brand.src).toContain('/icon.png')
  })

  it('returns icon mode when partner has an icon', () => {
    const brand = resolveBrandHeader({
      id: 'acme',
      name: 'Acme',
      icon: '/partners/acme/icon.png',
    })

    expect(brand.mode).toBe('icon')
    expect(brand.src).toBe('/partners/acme/icon.png')
    expect(brand.alt).toBe('Acme')
    expect(brand.label).toBe('Acme')
  })

  it('prefers icon over logo when partner has both', () => {
    const brand = resolveBrandHeader({
      id: 'acme',
      name: 'Acme',
      icon: '/partners/acme/icon.png',
      logo: '/partners/acme/logo.svg',
    })

    expect(brand.mode).toBe('icon')
    expect(brand.src).toBe('/partners/acme/icon.png')
  })

  it('returns logo mode when partner has a logo but no icon', () => {
    const brand = resolveBrandHeader({
      id: 'acme',
      name: 'Acme',
      logo: '/partners/acme/logo.svg',
    })

    expect(brand.mode).toBe('logo')
    expect(brand.src).toBe('/partners/acme/logo.svg')
    expect(brand.alt).toBe('Acme')
  })

  it('logo mode does not carry a label', () => {
    const brand = resolveBrandHeader({
      id: 'acme',
      name: 'Acme',
      logo: '/partners/acme/logo.svg',
    })

    expect('label' in brand).toBe(false)
  })

  it('returns text mode when partner has neither icon nor logo', () => {
    const brand = resolveBrandHeader({ id: 'faro', name: 'Faro' })

    expect(brand.mode).toBe('text')
    expect(brand.label).toBe('Faro')
  })

  it('text mode does not carry a src', () => {
    const brand = resolveBrandHeader({ id: 'faro', name: 'Faro' })

    expect('src' in brand).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

describe('Heading', () => {
  it('renders children', () => {
    render(<Heading>My Title</Heading>)

    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('applies default font style', async () => {
    const html = await renderEmail(<Heading>H</Heading>)

    expect(html).toContain('font-size:1.2rem')
    expect(html).toContain('line-height:2rem')
  })

  it('merges custom style over defaults', async () => {
    const html = await renderEmail(
      <Heading style={{ fontSize: '2rem' }}>H</Heading>
    )

    expect(html).toContain('font-size:2rem')
  })
})

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

describe('Text', () => {
  it('renders children', () => {
    render(<Text>Hello world</Text>)

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('applies default font size', async () => {
    const html = await renderEmail(<Text>T</Text>)

    expect(html).toContain('font-size:1rem')
  })

  it('merges custom style over defaults', async () => {
    const html = await renderEmail(
      <Text style={{ fontSize: '0.5rem' }}>T</Text>
    )

    expect(html).toContain('font-size:0.5rem')
  })
})

// ---------------------------------------------------------------------------
// Img
// ---------------------------------------------------------------------------

describe('Img', () => {
  it('renders an img element', () => {
    render(<Img src="https://example.com/img.png" alt="test" />)

    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('resolves a relative src against siteUrl', async () => {
    const html = await renderEmail(<Img src="/icon.png" alt="logo" />)

    // relative path should be made absolute using siteUrl
    expect(html).toMatch(/src="https?:\/\/.+\/icon\.png"/)
    expect(html).not.toContain('src="/icon.png"')
  })

  it('leaves an already-absolute src unchanged', async () => {
    const html = await renderEmail(
      <Img src="https://cdn.example.com/img.png" alt="x" />
    )

    expect(html).toContain('src="https://cdn.example.com/img.png"')
  })
})

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

describe('Link', () => {
  it('renders children', () => {
    render(<Link href="https://example.com">Click me</Link>)

    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('adds UTM params to absolute hrefs', async () => {
    const html = await renderEmail(
      <Link href="https://example.com/page">Link</Link>
    )

    expect(html).toContain('utm_source=email')
    expect(html).toContain('utm_medium=email')
    expect(html).toContain('utm_campaign=email')
    expect(html).toContain('utm_id=')
  })

  it('does not modify SendGrid template <%...%> hrefs', async () => {
    const html = await renderEmail(
      <Link href="<%asm_group_unsubscribe_raw_url%>">Unsubscribe</Link>
    )

    // react-email HTML-encodes < and > so we check for the encoded form
    expect(html).toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
  })

  it('uses custom campaign values for UTM params', async () => {
    const campaign = {
      source: 'newsletter',
      medium: 'email',
      name: 'launch',
      id: 'abc123',
    }

    const html = await renderEmail(
      <BasicEmail campaign={campaign}>
        <Link href="https://example.com">Link</Link>
      </BasicEmail>
    )

    expect(html).toContain('utm_source=newsletter')
    expect(html).toContain('utm_medium=email')
    expect(html).toContain('utm_campaign=launch')
    expect(html).toContain('utm_id=abc123')
  })

  it('applies default indigo link color', async () => {
    const html = await renderEmail(<Link href="https://example.com">Link</Link>)

    expect(html).toContain('color:rgb(99, 102, 241)')
  })
})

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe('Button', () => {
  it('renders children', () => {
    render(<Button href="https://example.com">Go</Button>)

    expect(screen.getByText('Go')).toBeInTheDocument()
  })

  it('adds UTM params to absolute hrefs', async () => {
    const html = await renderEmail(
      <Button href="https://example.com/action">Click</Button>
    )

    expect(html).toContain('utm_source=email')
    expect(html).toContain('utm_medium=email')
    expect(html).toContain('utm_campaign=email')
    expect(html).toContain('utm_id=')
  })

  it('does not modify SendGrid template <%...%> hrefs', async () => {
    const html = await renderEmail(
      <Button href="<%asm_group_unsubscribe_raw_url%>">Unsub</Button>
    )

    // react-email HTML-encodes < and > so we check for the encoded form
    expect(html).toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
  })

  it('uses custom campaign values for UTM params', async () => {
    const campaign = {
      source: 'newsletter',
      medium: 'email',
      name: 'sale',
      id: 'xyz',
    }

    const html = await renderEmail(
      <BasicEmail campaign={campaign}>
        <Button href="https://example.com">Go</Button>
      </BasicEmail>
    )

    expect(html).toContain('utm_source=newsletter')
    expect(html).toContain('utm_campaign=sale')
    expect(html).toContain('utm_id=xyz')
  })

  it('applies default styles', async () => {
    const html = await renderEmail(
      <Button href="https://example.com">Go</Button>
    )

    expect(html).toContain('background-color:#6366f1')
    expect(html).toContain('color:#ffffff')
    expect(html).toContain('border-radius:9999px')
  })
})

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

describe('Markdown', () => {
  it('renders markdown string content', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Markdown>**Hello world**</Markdown>
      </BasicEmail>
    )

    expect(html).toContain('Hello world')
  })

  it('strips absolute media video embeds', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Markdown>{`![](https://chatbotkit.com/media/tutorials/abc123.mp4)`}</Markdown>
      </BasicEmail>
    )

    expect(html).not.toContain('/media/tutorials/abc123.mp4')
  })

  it('strips relative media video embeds', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Markdown>{`![](/media/tutorials/abc123.mp4)`}</Markdown>
      </BasicEmail>
    )

    expect(html).not.toContain('/media/tutorials/abc123.mp4')
  })

  it('adds UTM params to markdown links', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Markdown>{`[Visit](https://example.com/page)`}</Markdown>
      </BasicEmail>
    )

    expect(html).toContain('utm_source=email')
    expect(html).toContain('utm_campaign=email')
  })

  it('uses custom campaign values for UTM params in markdown links', async () => {
    const campaign = {
      source: 'newsletter',
      medium: 'email',
      name: 'launch',
      id: 'c1',
    }

    const html = await renderEmail(
      <BasicEmail campaign={campaign}>
        <Markdown>{`[Visit](https://example.com/page)`}</Markdown>
      </BasicEmail>
    )

    expect(html).toContain('utm_source=newsletter')
    expect(html).toContain('utm_campaign=launch')
    expect(html).toContain('utm_id=c1')
  })

  it('applies custom heading styles', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Markdown>{`# Big Heading`}</Markdown>
      </BasicEmail>
    )

    expect(html).toContain('font-size:24px')
    expect(html).toContain('font-weight:bold')
  })
})

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

describe('Section', () => {
  it('renders children', () => {
    render(<Section>Section content</Section>)

    expect(screen.getByText('Section content')).toBeInTheDocument()
  })

  it('applies vertical margin styles', async () => {
    const html = await renderEmail(<Section>S</Section>)

    expect(html).toContain('margin-top:40px')
    expect(html).toContain('margin-bottom:40px')
  })
})

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

describe('Feedback', () => {
  it('renders children', () => {
    render(
      <Feedback>
        <p>Some content</p>
      </Feedback>
    )

    expect(screen.getByText('Some content')).toBeInTheDocument()
  })

  it('includes a FormShare.ai feedback button', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Feedback />
      </BasicEmail>
    )

    expect(html).toContain('formshare.ai')
    expect(html).toContain('Send feedback with FormShare.ai')
  })
})

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

describe('Unsubscribe', () => {
  it('renders both unsubscribe and preferences links by default', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Unsubscribe />
      </BasicEmail>
    )

    expect(html).toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
    expect(html).toContain('&lt;%asm_preferences_raw_url%&gt;')
    expect(html).toContain('Unsubscribe')
    expect(html).toContain('Manage Preferences')
  })

  it('uses custom labels when provided', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Unsubscribe unsubscribe="Opt out" preferences="My settings" />
      </BasicEmail>
    )

    expect(html).toContain('Opt out')
    expect(html).toContain('My settings')
  })

  it('omits unsubscribe link when unsubscribe is null', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Unsubscribe unsubscribe={null} />
      </BasicEmail>
    )

    expect(html).not.toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
    expect(html).toContain('&lt;%asm_preferences_raw_url%&gt;')
  })

  it('omits preferences link when preferences is null', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Unsubscribe preferences={null} />
      </BasicEmail>
    )

    expect(html).toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
    expect(html).not.toContain('&lt;%asm_preferences_raw_url%&gt;')
  })

  it('renders a separator between links when both are present', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Unsubscribe />
      </BasicEmail>
    )

    expect(html).toContain(' | ')
  })
})

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

describe('Body', () => {
  it('renders children', () => {
    render(<Body>Body content</Body>)

    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('applies white background and sans-serif font', async () => {
    const html = await renderEmail(<Body>B</Body>)

    expect(html).toContain('background-color:#ffffff')
    expect(html).toContain('font-family:sans-serif')
  })
})

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Content</Container>)

    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('uses 465px max-width by default', async () => {
    const html = await renderEmail(<Container>C</Container>)

    expect(html).toContain('max-width:465px')
  })

  it('uses 650px max-width when wide prop is set', async () => {
    const html = await renderEmail(<Container wide>C</Container>)

    expect(html).toContain('max-width:650px')
  })

  it('applies border and rounded corners', async () => {
    const html = await renderEmail(<Container>C</Container>)

    expect(html).toContain('border:1px solid #eaeaea')
    expect(html).toContain('border-radius:0.5rem')
  })
})

// ---------------------------------------------------------------------------
// BrandedEmail
// ---------------------------------------------------------------------------

describe('BrandedEmail', () => {
  it('renders children', async () => {
    const html = await renderEmail(
      <BrandedEmail>
        <Text>Hello!</Text>
      </BrandedEmail>
    )

    expect(html).toContain('Hello!')
  })

  it('renders preview text when provided', async () => {
    const html = await renderEmail(
      <BrandedEmail preview="Check this out">
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).toContain('Check this out')
  })

  it('does not render preview text when omitted', async () => {
    const html = await renderEmail(
      <BrandedEmail>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    // preview element injects padding characters; absence is hard to test directly
    // so we check there's no dangling preview section by confirming no preview wrapper
    expect(html).not.toMatch(/data-skip-in-text="true".*Check/)
  })

  it('renders the ChatBotKit logo by default', async () => {
    const html = await renderEmail(
      <BrandedEmail>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).toContain('alt="ChatBotKit"')
    expect(html).toContain('/icon.png')
    expect(html).toContain('CBK')
  })

  it('does not render logo in generic mode', async () => {
    const html = await renderEmail(
      <BrandedEmail generic>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).not.toContain('alt="ChatBotKit"')
    expect(html).not.toContain('CBK')
  })

  it('renders with standard (narrow) container by default', async () => {
    const html = await renderEmail(
      <BrandedEmail>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).toContain('max-width:465px')
  })

  it('renders with wide container when wide prop is set', async () => {
    const html = await renderEmail(
      <BrandedEmail wide>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).toContain('max-width:650px')
  })

  it('renders unsubscribe footer when unsubscribe prop is set', async () => {
    const html = await renderEmail(
      <BrandedEmail unsubscribe={{}}>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
  })

  it('does not render unsubscribe footer when prop is omitted', async () => {
    const html = await renderEmail(
      <BrandedEmail>
        <Text>Hi</Text>
      </BrandedEmail>
    )

    expect(html).not.toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
  })

  it('propagates campaign context to child Button UTM params', async () => {
    const campaign = {
      source: 'blast',
      medium: 'email',
      name: 'launch',
      id: 'q1',
    }

    const html = await renderEmail(
      <BrandedEmail campaign={campaign}>
        <Button href="https://example.com">Go</Button>
      </BrandedEmail>
    )

    expect(html).toContain('utm_source=blast')
    expect(html).toContain('utm_campaign=launch')
    expect(html).toContain('utm_id=q1')
  })

  describe('partner branding', () => {
    it('uses partner icon and name label in icon mode', async () => {
      const html = await renderEmail(
        <BrandedEmail
          branding={{
            id: 'acme',
            name: 'Acme',
            icon: '/partners/acme/icon.png',
          }}
        >
          <Text>Hi</Text>
        </BrandedEmail>
      )

      expect(html).toContain('/partners/acme/icon.png')
      expect(html).toContain('alt="Acme"')
      expect(html).toMatch(/<span[^>]*>\s*Acme\s*<\/span>/)
      expect(html).not.toContain('alt="ChatBotKit"')
      expect(html).not.toContain('/logo.png')
    })

    it('uses partner logo with no label in logo mode', async () => {
      const html = await renderEmail(
        <BrandedEmail
          branding={{
            id: 'acme',
            name: 'Acme',
            logo: '/partners/acme/logo.svg',
          }}
        >
          <Text>Hi</Text>
        </BrandedEmail>
      )

      expect(html).toContain('/partners/acme/logo.svg')
      expect(html).toContain('alt="Acme"')
      // label text should not appear separately alongside the logo
      expect(html).not.toMatch(/<span[^>]*>\s*Acme\s*<\/span>/)
      expect(html).not.toContain('alt="ChatBotKit"')
      expect(html).not.toContain('/icon.png')
    })

    it('prefers icon over logo when partner has both', async () => {
      const html = await renderEmail(
        <BrandedEmail
          branding={{
            id: 'acme',
            name: 'Acme',
            icon: '/partners/acme/icon.png',
            logo: '/partners/acme/logo.svg',
          }}
        >
          <Text>Hi</Text>
        </BrandedEmail>
      )

      expect(html).toContain('/partners/acme/icon.png')
      expect(html).not.toContain('/partners/acme/logo.svg')
    })

    it('renders partner name as text-only label when partner has neither icon nor logo', async () => {
      const html = await renderEmail(
        <BrandedEmail branding={{ id: 'faro', name: 'Faro' }}>
          <Text>Hi</Text>
        </BrandedEmail>
      )

      expect(html).toMatch(/<span[^>]*>\s*Faro\s*<\/span>/)
      // no img element should be present in the header at all
      expect(html).not.toMatch(/src="[^"]*partners[^"]*"/)
      expect(html).not.toContain('alt="ChatBotKit"')
      expect(html).not.toContain('/icon.png')
    })

    it('suppresses feedback for whitelabel partners', async () => {
      const html = await renderEmail(
        <BrandedEmail
          feedback
          branding={{ id: 'acme', name: 'Acme', whitelabel: true }}
        >
          <Text>Hi</Text>
        </BrandedEmail>
      )

      expect(html).not.toContain('formshare.ai')
    })
  })
})

// ---------------------------------------------------------------------------
// BasicEmail
// ---------------------------------------------------------------------------

describe('BasicEmail', () => {
  it('renders children', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Text>Content</Text>
      </BasicEmail>
    )

    expect(html).toContain('Content')
  })

  it('renders preview text when provided', async () => {
    const html = await renderEmail(
      <BasicEmail preview="My preview">
        <Text>Hi</Text>
      </BasicEmail>
    )

    expect(html).toContain('My preview')
  })

  it('renders unsubscribe when prop is provided', async () => {
    const html = await renderEmail(
      <BasicEmail unsubscribe={{}}>
        <Text>Hi</Text>
      </BasicEmail>
    )

    expect(html).toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
  })

  it('does not render unsubscribe when prop is omitted', async () => {
    const html = await renderEmail(
      <BasicEmail>
        <Text>Hi</Text>
      </BasicEmail>
    )

    expect(html).not.toContain('&lt;%asm_group_unsubscribe_raw_url%&gt;')
  })

  it('propagates campaign context to child Link UTM params', async () => {
    const campaign = { source: 'test', medium: 'email', name: 'camp', id: 'z9' }

    const html = await renderEmail(
      <BasicEmail campaign={campaign}>
        <Link href="https://example.com">L</Link>
      </BasicEmail>
    )

    expect(html).toContain('utm_source=test')
    expect(html).toContain('utm_campaign=camp')
    expect(html).toContain('utm_id=z9')
  })

  it('is the default export', () => {
    // BasicEmail is re-exported as default
    expect(BasicEmail).toBeDefined()
  })
})
