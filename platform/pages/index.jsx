export default function Index() {
  return null
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/overview',
      permanent: false,
    },
  }
}
