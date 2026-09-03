import { MdContentCopy } from 'react-icons/md'

import CodeBlock from '@/components/CodeBlock'
import { copyTextToClipboard } from '@/components/CopyButton'
import RevealToken from '@/components/RevealToken'
import SimpleTabs from '@/components/SimpleTabs'

import clsx from 'clsx'

/**
 * Generic webhook setup component for integrations
 */
export default function WebhookSetupSection({
  endpoints = [],
  secrets = [],
  instructions = [],

  code,

  className,

  children,

  ...props
}) {
  const handleCopyClick = (value, successMessage) => {
    copyTextToClipboard(value, successMessage || 'Copied to clipboard')
  }

  return (
    <div className={clsx('space-y-6', className)} {...props}>
      {/* Endpoints */}
      {endpoints.length > 0 && (
        <div className="space-y-6">
          {endpoints.map((endpoint, index) => (
            <div key={index}>
              <label className="default-label">
                {endpoint.label}
                {endpoint.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <div className="mt-1 relative">
                <input
                  className="default-input w-full sm:text-sm pr-10"
                  type="text"
                  value={endpoint.url}
                  readOnly
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() =>
                    handleCopyClick(endpoint.url, endpoint.copyMessage)
                  }
                  title="Copy to clipboard"
                >
                  <MdContentCopy className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                </button>
              </div>
              {endpoint.description && (
                <p className="input-description">{endpoint.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Secrets */}
      {secrets.length > 0 && (
        <div className="space-y-6">
          {secrets.map((secret, index) => (
            <div key={index}>
              <label className="default-label" htmlFor={secret.name}>
                {secret.label}
                {secret.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <div className="mt-1 relative">
                {secret.type === 'reveal' ? (
                  <div className="relative">
                    <RevealToken
                      className="default-input w-full sm:text-sm pr-10"
                      token={secret.value || ''}
                      readOnly
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() =>
                        handleCopyClick(secret.value, secret.copyMessage)
                      }
                      title="Copy to clipboard"
                    >
                      <MdContentCopy className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className="default-input w-full sm:text-sm pr-10"
                      type="text"
                      name={secret.name}
                      id={secret.name}
                      defaultValue={secret.value}
                      placeholder={secret.placeholder}
                    />
                    {secret.value && (
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() =>
                          handleCopyClick(secret.value, secret.copyMessage)
                        }
                        title="Copy to clipboard"
                      >
                        <MdContentCopy className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {secret.description && (
                <p className="input-description">{secret.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Instructions */}
      {instructions.length > 0 && (
        <div className="prose prose-sm dark:prose-invert">
          <h4>Setup Instructions</h4>
          <ol>
            {instructions.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </div>
      )}
      {/* Code */}
      {code && (
        <div>
          <label className="default-label">Code Example</label>
          <div className="mt-1">
            <CodeBlock
              className="text-xs max-h-96 overflow-auto"
              language={code.language}
            >
              {code.content}
            </CodeBlock>
          </div>
        </div>
      )}
      {/* Additional Content */}
      {children}
    </div>
  )
}

WebhookSetupSection.Multi = function WebhookSetupSectionMulti({
  sections = {},

  ...props
}) {
  const tabs = Object.fromEntries(
    Object.entries(sections).map(([key, section]) => [
      section.title || key,
      {
        content: (
          <WebhookSetupSection
            endpoints={section.endpoints}
            secrets={section.secrets}
            instructions={section.instructions}
            code={section.code}
          >
            {section.children}
          </WebhookSetupSection>
        ),
      },
    ])
  )

  return <SimpleTabs {...props} tabs={tabs} />
}
