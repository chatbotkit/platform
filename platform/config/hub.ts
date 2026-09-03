export interface Hub {
  limits: {
    take: number
  }
}

const hub: Hub = {
  limits: {
    take: 32,
  },
}

export default hub
