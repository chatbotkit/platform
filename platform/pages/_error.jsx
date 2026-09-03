import NextError from 'next/error'

import observability from '@chatbotkit-dev/observability'

export default function CustomError(props) {
  return <NextError statusCode={props.statusCode} />
}

CustomError.getInitialProps = async function (context) {
  // In case this is running in a serverless function, await this in order to
  // give Sentry time to send the error before the lambda exits

  await observability.captureFrameworkError(context)

  // This will contain the status code of the response

  return NextError.getInitialProps(context)
}
