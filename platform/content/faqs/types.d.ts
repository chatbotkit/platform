declare module '@/content/faqs/*.yaml' {
  interface FAQ {
    question: string
    answer: string
  }

  const faq: FAQ[]

  export default faq
}
