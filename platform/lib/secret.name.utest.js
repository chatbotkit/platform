import { humanizeSecretName, normalizeSecretName } from '@/lib/secret.name'

describe('secret.name', () => {
  describe('normalizeSecretName', () => {
    it('should convert basic strings to lowercase with underscores', () => {
      expect(normalizeSecretName('MySecretName')).toBe('mysecretname')
      expect(normalizeSecretName('API_KEY')).toBe('api_key')
      expect(normalizeSecretName('simple')).toBe('simple')
    })

    it('should replace special characters with underscores', () => {
      expect(normalizeSecretName('my-secret-name')).toBe('my_secret_name')
      expect(normalizeSecretName('my.secret.name')).toBe('my_secret_name')
      expect(normalizeSecretName('my@secret#name')).toBe('my_secret_name')
      expect(normalizeSecretName('my secret name')).toBe('my_secret_name')
    })

    it('should handle multiple consecutive special characters', () => {
      expect(normalizeSecretName('my---secret___name')).toBe('my_secret_name')
      expect(normalizeSecretName('my...secret...name')).toBe('my_secret_name')
      expect(normalizeSecretName('my@@@secret###name')).toBe('my_secret_name')
      expect(normalizeSecretName('my   secret   name')).toBe('my_secret_name')
    })

    it('should handle mixed special characters', () => {
      expect(normalizeSecretName('my-_secret._name')).toBe('my_secret_name')
      expect(normalizeSecretName('API-KEY_V2.test')).toBe('api_key_v2_test')
      expect(normalizeSecretName('OAuth2.0-Token')).toBe('oauth2_0_token')
    })

    it('should handle edge cases with whitespace', () => {
      expect(normalizeSecretName('  my secret  ')).toBe('my_secret')
      expect(normalizeSecretName('\tmy\tsecret\t')).toBe('my_secret')
      expect(normalizeSecretName('\nmy\nsecret\n')).toBe('my_secret')
    })

    it('should handle numeric characters correctly', () => {
      expect(normalizeSecretName('secret123')).toBe('secret123')
      expect(normalizeSecretName('API_V2_KEY')).toBe('api_v2_key')
      expect(normalizeSecretName('oauth2.0')).toBe('oauth2_0')
    })

    it('should handle empty and minimal input', () => {
      expect(normalizeSecretName('')).toBe('')
      expect(normalizeSecretName('a')).toBe('a')
      expect(normalizeSecretName('A')).toBe('a')
    })

    it('should handle strings with only special characters', () => {
      expect(normalizeSecretName('---')).toBe('')
      expect(normalizeSecretName('...')).toBe('')
      expect(normalizeSecretName('@#$')).toBe('')
      expect(normalizeSecretName('   ')).toBe('')
    })

    it('should handle leading and trailing special characters', () => {
      expect(normalizeSecretName('_secret_')).toBe('secret')
      expect(normalizeSecretName('-secret-')).toBe('secret')
      expect(normalizeSecretName('!secret!')).toBe('secret')
      expect(normalizeSecretName(' secret ')).toBe('secret')
    })

    it('should handle complex real-world examples', () => {
      expect(normalizeSecretName('AWS_S3_Bucket-Name')).toBe(
        'aws_s3_bucket_name'
      )
      expect(normalizeSecretName('Google.OAuth2.Client_ID')).toBe(
        'google_oauth2_client_id'
      )
      expect(normalizeSecretName('Database-Connection-String_V2')).toBe(
        'database_connection_string_v2'
      )
      expect(normalizeSecretName('JWT@Secret#Key!')).toBe('jwt_secret_key')
    })

    it('should handle edge cases after trimming fix', () => {
      expect(normalizeSecretName('!!!important!!!')).toBe('important')
      expect(normalizeSecretName('___test___')).toBe('test')
      expect(normalizeSecretName('   !!!test!!!   ')).toBe('test')
      expect(normalizeSecretName('...start...middle...end...')).toBe(
        'start_middle_end'
      )
    })
  })

  describe('humanizeSecretName', () => {
    it('should capitalize first letter of each word', () => {
      expect(humanizeSecretName('my_secret_name')).toBe('My Secret Name')
      expect(humanizeSecretName('api_key')).toBe('API Key')
      expect(humanizeSecretName('simple')).toBe('Simple')
    })

    it('should handle mixed case input', () => {
      expect(humanizeSecretName('MY_SECRET_NAME')).toBe('My Secret Name')
      expect(humanizeSecretName('Api_Key_Value')).toBe('API Key Value')
      expect(humanizeSecretName('MiXeD_cAsE_nAmE')).toBe('Mixed Case Name')
    })

    it('should preserve API capitalization', () => {
      expect(humanizeSecretName('api_key')).toBe('API Key')
      expect(humanizeSecretName('my_api_token')).toBe('My API Token')
      expect(humanizeSecretName('rest_api_endpoint')).toBe('Rest API Endpoint')
      expect(humanizeSecretName('api_v2_key')).toBe('API V2 Key')
    })

    it('should handle whitespace trimming', () => {
      expect(humanizeSecretName('  my_secret_name  ')).toBe('My Secret Name')
      expect(humanizeSecretName('\tapi_key\t')).toBe('API Key')
      expect(humanizeSecretName('\nmy_token\n')).toBe('My Token')
    })

    it('should handle single words', () => {
      expect(humanizeSecretName('secret')).toBe('Secret')
      expect(humanizeSecretName('api')).toBe('API')
      expect(humanizeSecretName('token')).toBe('Token')
    })

    it('should handle empty and minimal input', () => {
      expect(humanizeSecretName('')).toBe('')
      expect(humanizeSecretName('a')).toBe('A')
      expect(humanizeSecretName('_')).toBe(' ')
    })

    it('should handle multiple consecutive underscores', () => {
      expect(humanizeSecretName('my___secret___name')).toBe(
        'My   Secret   Name'
      )
      expect(humanizeSecretName('api__key')).toBe('API  Key')
    })

    it('should handle real-world examples', () => {
      expect(humanizeSecretName('aws_s3_bucket_name')).toBe(
        'Aws S3 Bucket Name'
      )
      expect(humanizeSecretName('google_oauth2_client_id')).toBe(
        'Google Oauth2 Client Id'
      )
      expect(humanizeSecretName('database_connection_string')).toBe(
        'Database Connection String'
      )
      expect(humanizeSecretName('jwt_secret_key')).toBe('Jwt Secret Key')
      expect(humanizeSecretName('stripe_api_key')).toBe('Stripe API Key')
    })

    it('should handle edge cases with API positioning', () => {
      expect(humanizeSecretName('api')).toBe('API')
      expect(humanizeSecretName('my_api')).toBe('My API')
      expect(humanizeSecretName('api_token_v2')).toBe('API Token V2')
      expect(humanizeSecretName('third_party_api_key')).toBe(
        'Third Party API Key'
      )
    })

    it('should handle trailing underscores and spaces', () => {
      expect(humanizeSecretName('secret_name_')).toBe('Secret Name ')
      expect(humanizeSecretName('_secret_name')).toBe(' Secret Name')
      expect(humanizeSecretName('_secret_name_')).toBe(' Secret Name ')
    })
  })

  describe('integration tests', () => {
    it('should work together for normalize then humanize workflow', () => {
      const input = 'My-Secret@API#Key!'
      const normalized = normalizeSecretName(input)
      const humanized = humanizeSecretName(normalized)

      expect(normalized).toBe('my_secret_api_key')
      expect(humanized).toBe('My Secret API Key')
    })

    it('should handle complex real-world workflow', () => {
      const inputs = [
        'AWS.S3-Bucket_Name',
        'Google OAuth2 Client@ID',
        'Database Connection String V2',
        'JWT Secret Key!',
      ]

      const expected = [
        'Aws S3 Bucket Name',
        'Google Oauth2 Client Id',
        'Database Connection String V2',
        'Jwt Secret Key',
      ]

      inputs.forEach((input, index) => {
        const normalized = normalizeSecretName(input)
        const humanized = humanizeSecretName(normalized)

        expect(humanized).toBe(expected[index])
      })
    })
  })
})
