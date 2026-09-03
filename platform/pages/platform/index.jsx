export default function Index() {
  null
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/platform/models',
      permanent: false,
    },
  }
}
