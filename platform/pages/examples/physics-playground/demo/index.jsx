import { useEffect, useRef, useState } from 'react'

import Head from 'next/head'
import Script from 'next/script'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

/**
 * The example demonstrates how to use client-side functions to interact with
 * the ChatBotKit AI Widget. The example allows an AI bot to create and control
 * physics objects in a fun interactive playground for kids to learn about physics.
 */
export default function Page() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const dimensionsRef = useRef({ width: 800, height: 600 })

  const [matterLoaded, setMatterLoaded] = useState(false)

  const widget = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    if (!canvasRef.current || !matterLoaded || !window.Matter) {
      return
    }

    const Matter = window.Matter
    const Engine = Matter.Engine
    const Render = Matter.Render
    const Runner = Matter.Runner
    const Bodies = Matter.Bodies
    const Body = Matter.Body
    const Composite = Matter.Composite
    const Constraint = Matter.Constraint
    const Mouse = Matter.Mouse
    const MouseConstraint = Matter.MouseConstraint

    // get dynamic dimensions from container

    const width = canvasRef.current.clientWidth
    const height = canvasRef.current.clientHeight

    // store dimensions for use in functions

    dimensionsRef.current = { width, height }

    // create engine

    const engine = Engine.create()

    engine.gravity.y = 1

    // create renderer

    const render = Render.create({
      element: canvasRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: '#f0f9ff',
      },
    })

    // create boundaries - thick walls to contain all objects

    const boundaryThickness = 60

    dimensionsRef.current = { width, height, boundaryThickness }

    // ground (bottom of canvas)

    const ground = Bodies.rectangle(
      width / 2,
      height - boundaryThickness / 2,
      width,
      boundaryThickness,
      {
        isStatic: true,
        friction: 0.5,
        render: {
          fillStyle: 'rgba(16, 185, 129, 0.1)',
        },
        label: 'ground',
      }
    )

    // ceiling (top of canvas)

    const ceiling = Bodies.rectangle(
      width / 2,
      boundaryThickness / 2,
      width,
      boundaryThickness,
      {
        isStatic: true,
        friction: 0.5,
        render: {
          fillStyle: 'rgba(148, 163, 184, 0.1)',
        },
        label: 'ceiling',
      }
    )

    // left wall

    const leftWall = Bodies.rectangle(
      boundaryThickness / 2,
      height / 2,
      boundaryThickness,
      height,
      {
        isStatic: true,
        friction: 0.5,
        render: {
          fillStyle: 'rgba(148, 163, 184, 0.1)',
        },
        label: 'leftWall',
      }
    )

    // right wall

    const rightWall = Bodies.rectangle(
      width - boundaryThickness / 2,
      height / 2,
      boundaryThickness,
      height,
      {
        isStatic: true,
        friction: 0.5,
        render: {
          fillStyle: 'rgba(148, 163, 184, 0.1)',
        },
        label: 'rightWall',
      }
    )

    // add all boundaries to the world

    Composite.add(engine.world, [ground, ceiling, leftWall, rightWall])

    // add mouse control

    const mouse = Mouse.create(render.canvas)
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false,
        },
      },
    })

    Composite.add(engine.world, mouseConstraint)

    // keep the mouse in sync with rendering

    render.mouse = mouse

    // handle window resize

    const handleResize = () => {
      if (!canvasRef.current || !render || !engine) {
        return
      }

      const newWidth = canvasRef.current.clientWidth
      const newHeight = canvasRef.current.clientHeight

      // update render canvas size

      render.canvas.width = newWidth
      render.canvas.height = newHeight
      render.options.width = newWidth
      render.options.height = newHeight

      // update dimensions ref for functions

      dimensionsRef.current = {
        width: newWidth,
        height: newHeight,
        boundaryThickness,
      }

      // update boundary positions and sizes

      const boundaries = Composite.allBodies(engine.world).filter(
        (body) =>
          body.label === 'ground' ||
          body.label === 'ceiling' ||
          body.label === 'leftWall' ||
          body.label === 'rightWall'
      )

      boundaries.forEach((body) => {
        if (body.label === 'ground') {
          Body.setPosition(body, {
            x: newWidth / 2,
            y: newHeight - boundaryThickness / 2,
          })
          Body.setVertices(
            body,
            Bodies.rectangle(0, 0, newWidth, boundaryThickness).vertices
          )
        } else if (body.label === 'ceiling') {
          Body.setPosition(body, {
            x: newWidth / 2,
            y: boundaryThickness / 2,
          })
          Body.setVertices(
            body,
            Bodies.rectangle(0, 0, newWidth, boundaryThickness).vertices
          )
        } else if (body.label === 'leftWall') {
          Body.setPosition(body, {
            x: boundaryThickness / 2,
            y: newHeight / 2,
          })
          Body.setVertices(
            body,
            Bodies.rectangle(0, 0, boundaryThickness, newHeight).vertices
          )
        } else if (body.label === 'rightWall') {
          Body.setPosition(body, {
            x: newWidth - boundaryThickness / 2,
            y: newHeight / 2,
          })
          Body.setVertices(
            body,
            Bodies.rectangle(0, 0, boundaryThickness, newHeight).vertices
          )
        }
      })

      // update mouse pixel ratio

      Mouse.setScale(mouse, {
        x: newWidth / render.canvas.width,
        y: newHeight / render.canvas.height,
      })

      // force bounds update

      Render.lookAt(render, {
        min: { x: 0, y: 0 },
        max: { x: newWidth, y: newHeight },
      })
    }

    window.addEventListener('resize', handleResize)

    // run the engine and renderer

    const runner = Runner.create()

    Runner.run(runner, engine)
    Render.run(render)

    engineRef.current = engine
    renderRef.current = render

    return () => {
      window.removeEventListener('resize', handleResize)

      Render.stop(render)
      Runner.stop(runner)
      Engine.clear(engine)
      render.canvas.remove()
      render.textures = {}
    }
  }, [matterLoaded])

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget || !engineRef.current) {
      return
    }

    const Matter = window.Matter
    const Bodies = Matter.Bodies
    const Body = Matter.Body
    const Composite = Matter.Composite

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

    const randomInRange = (min, max) =>
      min >= max ? min : Math.random() * (max - min) + min

    const getSafeArea = () => {
      const {
        width: canvasWidth = 800,
        height: canvasHeight = 600,
        boundaryThickness = 60,
      } = dimensionsRef.current || {}

      return { canvasWidth, canvasHeight, boundaryThickness }
    }

    // color palette for objects

    const colors = [
      '#ef4444',
      '#f59e0b',
      '#10b981',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ]

    // setup the functions available to the widget AI bot

    widget.functions = {
      addBall: {
        description:
          'Add a bouncy ball to the physics world. Balls are circles that bounce around.',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description:
                'The x position where to add the ball (default is random)',
            },
            y: {
              type: 'number',
              description:
                'The y position where to add the ball (default is just below the top wall)',
            },
            radius: {
              type: 'number',
              description: 'The radius of the ball (10-80, default is 30)',
            },
            color: {
              type: 'string',
              description:
                'The color of the ball (red, orange, green, blue, purple, pink, or hex color)',
            },
          },
        },
        handler: async ({ x, y, radius = 30, color }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const ballRadius = clamp(radius ?? 30, 10, 80)

          const safeLeft = boundaryThickness + ballRadius + 5
          const safeRight = Math.max(
            safeLeft,
            canvasWidth - boundaryThickness - ballRadius - 5
          )
          const safeTop = boundaryThickness + ballRadius + 5
          const safeBottom = Math.max(
            safeTop,
            canvasHeight - boundaryThickness - ballRadius - 5
          )

          const xPos =
            typeof x === 'number'
              ? clamp(x, safeLeft, safeRight)
              : randomInRange(safeLeft, safeRight)

          const requestedY = typeof y === 'number' ? y : safeTop

          const yPos = clamp(requestedY, safeTop, safeBottom)

          const colorMap = {
            red: colors[0],
            orange: colors[1],
            green: colors[2],
            blue: colors[3],
            purple: colors[4],
            pink: colors[5],
          }

          const ballColor =
            colorMap[color?.toLowerCase()] ||
            color ||
            colors[Math.floor(Math.random() * colors.length)]

          const ball = Bodies.circle(xPos, yPos, ballRadius, {
            restitution: 0.8,
            render: {
              fillStyle: ballColor,
            },
          })

          Composite.add(engineRef.current.world, ball)

          return {
            success: true,
            message: `Added a ${
              color || 'colorful'
            } ball at position (${Math.round(xPos)}, ${Math.round(yPos)})`,
          }
        },
      },

      addBox: {
        description:
          'Add a box (rectangle) to the physics world. Boxes can stack and tumble.',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description:
                'The x position where to add the box (default is random)',
            },
            y: {
              type: 'number',
              description:
                'The y position where to add the box (default is just below the top wall)',
            },
            width: {
              type: 'number',
              description: 'The width of the box (20-100, default is 50)',
            },
            height: {
              type: 'number',
              description: 'The height of the box (20-100, default is 50)',
            },
            color: {
              type: 'string',
              description:
                'The color of the box (red, orange, green, blue, purple, pink, or hex color)',
            },
          },
        },
        handler: async ({ x, y, width = 50, height = 50, color }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const boxWidth = clamp(width ?? 50, 20, 100)
          const boxHeight = clamp(height ?? 50, 20, 100)

          const halfWidth = boxWidth / 2
          const halfHeight = boxHeight / 2

          const safeLeft = boundaryThickness + halfWidth + 5
          const safeRight = Math.max(
            safeLeft,
            canvasWidth - boundaryThickness - halfWidth - 5
          )
          const safeTop = boundaryThickness + halfHeight + 5
          const safeBottom = Math.max(
            safeTop,
            canvasHeight - boundaryThickness - halfHeight - 5
          )

          const xPos =
            typeof x === 'number'
              ? clamp(x, safeLeft, safeRight)
              : randomInRange(safeLeft, safeRight)

          const requestedY = typeof y === 'number' ? y : safeTop

          const yPos = clamp(requestedY, safeTop, safeBottom)

          const colorMap = {
            red: colors[0],
            orange: colors[1],
            green: colors[2],
            blue: colors[3],
            purple: colors[4],
            pink: colors[5],
          }

          const boxColor =
            colorMap[color?.toLowerCase()] ||
            color ||
            colors[Math.floor(Math.random() * colors.length)]

          const box = Bodies.rectangle(xPos, yPos, boxWidth, boxHeight, {
            restitution: 0.3,
            render: {
              fillStyle: boxColor,
            },
          })

          Composite.add(engineRef.current.world, box)

          return {
            success: true,
            message: `Added a ${
              color || 'colorful'
            } box at position (${Math.round(xPos)}, ${Math.round(yPos)})`,
          }
        },
      },

      setGravity: {
        description:
          'Change the gravity of the physics world. Higher values make things fall faster, lower values make them float more. Can even be negative to make things float up!',
        parameters: {
          type: 'object',
          properties: {
            gravity: {
              type: 'number',
              description:
                'The gravity value (-2 to 3, where 1 is Earth gravity, 0.16 is Moon gravity, default is 1)',
            },
          },
          required: ['gravity'],
        },
        handler: async ({ gravity }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const newGravity = Math.max(-2, Math.min(3, gravity))

          engineRef.current.gravity.y = newGravity

          let description = ''

          if (newGravity < 0) {
            description = 'Things are floating up!'
          } else if (newGravity < 0.5) {
            description = 'Low gravity, like on the Moon!'
          } else if (newGravity < 1.5) {
            description = 'Normal Earth gravity'
          } else {
            description = 'Super strong gravity!'
          }

          return {
            success: true,
            gravity: newGravity,
            message: `Gravity set to ${newGravity}. ${description}`,
          }
        },
      },

      clearAll: {
        description:
          'Remove all objects from the physics world (except the ground and walls)',
        parameters: {
          type: 'object',
          properties: {},
        },
        handler: async () => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const allBodies = Composite.allBodies(engineRef.current.world)
          const dynamicBodies = allBodies.filter((body) => !body.isStatic)

          Composite.remove(engineRef.current.world, dynamicBodies)

          return {
            success: true,
            message: 'Cleared all objects from the world!',
          }
        },
      },

      makeItRain: {
        description:
          'Make it rain balls! Creates multiple balls falling from the sky.',
        parameters: {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              description: 'How many balls to create (1-20, default is 10)',
            },
          },
        },
        handler: async ({ count = 10 }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const ballCount = clamp(count ?? 10, 1, 20)

          for (let i = 0; i < ballCount; i++) {
            const radius = clamp(Math.random() * 20 + 15, 10, 80)

            const safeLeft = boundaryThickness + radius + 5
            const safeRight = Math.max(
              safeLeft,
              canvasWidth - boundaryThickness - radius - 5
            )

            const safeTop = boundaryThickness + radius + 5

            const x = randomInRange(safeLeft, safeRight)

            const safeBottom = Math.max(
              safeTop,
              canvasHeight - boundaryThickness - radius - 5
            )

            const y = randomInRange(safeTop, Math.min(safeBottom, safeTop + 40))

            const color = colors[Math.floor(Math.random() * colors.length)]

            const ball = Bodies.circle(x, y, radius, {
              restitution: 0.9,
              render: {
                fillStyle: color,
              },
            })

            Composite.add(engineRef.current.world, ball)

            Body.setVelocity(ball, {
              x: (Math.random() - 0.5) * 2,
              y: Math.random() * 4 + 2,
            })
          }

          return {
            success: true,
            message: `Made it rain with ${ballCount} colorful balls!`,
          }
        },
      },

      setBounciness: {
        description:
          'Change how bouncy objects are (restitution/elasticity). Use this to teach about elastic vs inelastic collisions.',
        parameters: {
          type: 'object',
          properties: {
            bounciness: {
              type: 'number',
              description:
                'How bouncy (0 = no bounce/inelastic, 1 = perfect bounce/elastic, default is 0.8)',
            },
          },
          required: ['bounciness'],
        },
        handler: async ({ bounciness }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const newBounciness = clamp(bounciness ?? 0.8, 0, 1)
          const allBodies = Composite.allBodies(engineRef.current.world)
          const dynamicBodies = allBodies.filter((body) => !body.isStatic)

          dynamicBodies.forEach((body) => {
            body.restitution = newBounciness
          })

          let description = ''

          if (newBounciness < 0.2) {
            description =
              'Objects barely bounce - like clay! This is an inelastic collision.'
          } else if (newBounciness < 0.5) {
            description = 'Low bounce - objects lose energy when they hit.'
          } else if (newBounciness < 0.8) {
            description = 'Medium bounce - like a basketball!'
          } else {
            description =
              'Super bouncy - almost elastic! Objects keep their energy.'
          }

          return {
            success: true,
            bounciness: newBounciness,
            message: `Bounciness set to ${newBounciness}. ${description}`,
          }
        },
      },

      setFriction: {
        description:
          'Change how much friction objects have. Use this to teach how surfaces affect motion.',
        parameters: {
          type: 'object',
          properties: {
            friction: {
              type: 'number',
              description:
                'Friction value (0 = ice-like/slippery, 1 = very rough, default is 0.5)',
            },
          },
          required: ['friction'],
        },
        handler: async ({ friction }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const newFriction = clamp(friction ?? 0.5, 0, 2)
          const allBodies = Composite.allBodies(engineRef.current.world)
          const dynamicBodies = allBodies.filter((body) => !body.isStatic)

          dynamicBodies.forEach((body) => {
            body.friction = newFriction
          })

          let description = ''

          if (newFriction < 0.2) {
            description =
              'Super slippery - like ice! Objects slide easily and take longer to stop.'
          } else if (newFriction < 0.6) {
            description = 'Normal friction - like everyday surfaces.'
          } else {
            description =
              'High friction - like sandpaper! Objects slow down quickly.'
          }

          return {
            success: true,
            friction: newFriction,
            message: `Friction set to ${newFriction}. ${description}`,
          }
        },
      },

      pauseSimulation: {
        description:
          'Pause or resume the physics simulation. Useful for examining motion at specific moments.',
        parameters: {
          type: 'object',
          properties: {
            paused: {
              type: 'boolean',
              description: 'true to pause, false to resume',
            },
          },
          required: ['paused'],
        },
        handler: async ({ paused }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          engineRef.current.timing.timeScale = paused ? 0 : 1

          return {
            success: true,
            paused,
            message: paused
              ? 'Simulation paused! Now you can see exactly where everything is.'
              : 'Simulation resumed! Watch the motion continue.',
          }
        },
      },

      addRamp: {
        description:
          'Add a ramp/inclined plane to demonstrate gravity, acceleration, and rolling motion.',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description:
                'The x position of the ramp center (default is center)',
            },
            y: {
              type: 'number',
              description:
                'The y position of the ramp center (default is middle)',
            },
            angle: {
              type: 'number',
              description: 'Angle of the ramp in degrees (0-45, default is 25)',
            },
            length: {
              type: 'number',
              description: 'Length of the ramp (50-200, default is 150)',
            },
          },
        },
        handler: async ({ x, y, angle = 25, length = 150 }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const rampLength = clamp(length ?? 150, 50, 200)
          const rampAngle = clamp(angle ?? 25, 0, 45) * (Math.PI / 180)
          const rampWidth = 10

          const xPos =
            typeof x === 'number'
              ? clamp(
                  x,
                  boundaryThickness + 50,
                  canvasWidth - boundaryThickness - 50
                )
              : canvasWidth / 2

          const yPos =
            typeof y === 'number'
              ? clamp(
                  y,
                  boundaryThickness + 50,
                  canvasHeight - boundaryThickness - 50
                )
              : canvasHeight / 2

          const ramp = Bodies.rectangle(xPos, yPos, rampLength, rampWidth, {
            isStatic: true,
            angle: rampAngle,
            friction: 0.5,
            render: {
              fillStyle: '#94a3b8',
            },
          })

          Composite.add(engineRef.current.world, ramp)

          return {
            success: true,
            message: `Added a ramp at ${Math.round(
              angle ?? 25
            )}°! Roll a ball down to see acceleration!`,
          }
        },
      },

      createStack: {
        description:
          'Create a stack of boxes to demonstrate stability, balance, and center of gravity.',
        parameters: {
          type: 'object',
          properties: {
            height: {
              type: 'number',
              description: 'Number of boxes in the stack (1-10, default is 5)',
            },
            x: {
              type: 'number',
              description:
                'The x position where to create the stack (default is center)',
            },
          },
        },
        handler: async ({ height = 5, x }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const stackHeight = clamp(height ?? 5, 1, 10)
          const boxWidth = 50
          const boxHeight = 30

          const xPos =
            typeof x === 'number'
              ? clamp(
                  x,
                  boundaryThickness + boxWidth,
                  canvasWidth - boundaryThickness - boxWidth
                )
              : canvasWidth / 2

          for (let i = 0; i < stackHeight; i++) {
            const yPos =
              canvasHeight - boundaryThickness - boxHeight / 2 - i * boxHeight

            const box = Bodies.rectangle(xPos, yPos, boxWidth, boxHeight, {
              restitution: 0.3,
              friction: 0.8,
              render: {
                fillStyle: colors[i % colors.length],
              },
            })

            Composite.add(engineRef.current.world, box)
          }

          return {
            success: true,
            message: `Created a stack of ${stackHeight} boxes! Try pushing it to test stability.`,
          }
        },
      },

      setMass: {
        description:
          'Change the mass/weight of objects to demonstrate inertia and momentum.',
        parameters: {
          type: 'object',
          properties: {
            multiplier: {
              type: 'number',
              description:
                'Mass multiplier (0.1 = very light, 1 = normal, 5 = very heavy, default is 1)',
            },
          },
          required: ['multiplier'],
        },
        handler: async ({ multiplier }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const newMultiplier = clamp(multiplier ?? 1, 0.1, 5)
          const allBodies = Composite.allBodies(engineRef.current.world)
          const dynamicBodies = allBodies.filter((body) => !body.isStatic)

          dynamicBodies.forEach((body) => {
            Body.setMass(body, body.mass * newMultiplier)
          })

          let description = ''

          if (newMultiplier < 0.5) {
            description =
              'Objects are very light - easy to push but with less momentum!'
          } else if (newMultiplier < 1.5) {
            description = 'Normal mass - balanced properties.'
          } else {
            description =
              'Objects are very heavy - hard to move but lots of momentum!'
          }

          return {
            success: true,
            multiplier: newMultiplier,
            message: `Mass multiplier set to ${newMultiplier}x. ${description}`,
          }
        },
      },

      addPendulum: {
        description:
          'Add a pendulum to demonstrate periodic motion, gravity, and energy conservation. Great for learning about oscillation and harmonic motion!',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description:
                'The x position of the pivot point (default is center)',
            },
            y: {
              type: 'number',
              description:
                'The y position of the pivot point (default is near top)',
            },
            length: {
              type: 'number',
              description:
                'Length of the pendulum string (50-250, default is 150)',
            },
            mass: {
              type: 'number',
              description:
                'Mass of the pendulum bob (10-50, default is 20 for radius)',
            },
            startAngle: {
              type: 'number',
              description:
                'Starting angle in degrees from vertical (0-90, default is 45)',
            },
            color: {
              type: 'string',
              description:
                'Color of the pendulum bob (red, orange, green, blue, purple, pink, or hex)',
            },
          },
        },
        handler: async ({
          x,
          y,
          length = 150,
          mass = 20,
          startAngle = 45,
          color,
        }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const Constraint = Matter.Constraint

          const pendulumLength = clamp(length ?? 150, 50, 250)
          const bobRadius = clamp(mass ?? 20, 10, 50)
          const angleInRadians =
            clamp(startAngle ?? 45, 0, 90) * (Math.PI / 180)

          const pivotX =
            typeof x === 'number'
              ? clamp(
                  x,
                  boundaryThickness + 100,
                  canvasWidth - boundaryThickness - 100
                )
              : canvasWidth / 2

          const pivotY =
            typeof y === 'number'
              ? clamp(
                  y,
                  boundaryThickness + 50,
                  canvasHeight - boundaryThickness - pendulumLength - 100
                )
              : boundaryThickness + 100

          // Calculate bob starting position based on angle

          const bobX = pivotX + pendulumLength * Math.sin(angleInRadians)
          const bobY = pivotY + pendulumLength * Math.cos(angleInRadians)

          const colorMap = {
            red: colors[0],
            orange: colors[1],
            green: colors[2],
            blue: colors[3],
            purple: colors[4],
            pink: colors[5],
          }

          const bobColor =
            colorMap[color?.toLowerCase()] ||
            color ||
            colors[Math.floor(Math.random() * colors.length)]

          // Create pivot point (small static circle)

          const pivot = Bodies.circle(pivotX, pivotY, 5, {
            isStatic: true,
            render: {
              fillStyle: '#1f2937',
            },
            label: 'pendulum-pivot',
          })

          // Create pendulum bob

          const bob = Bodies.circle(bobX, bobY, bobRadius, {
            density: 0.04,
            frictionAir: 0.005,
            render: {
              fillStyle: bobColor,
            },
            label: 'pendulum-bob',
          })

          // Create constraint (string)

          const constraint = Constraint.create({
            bodyA: pivot,
            bodyB: bob,
            stiffness: 1,
            length: pendulumLength,
            render: {
              strokeStyle: '#1f2937',
              lineWidth: 2,
            },
          })

          Composite.add(engineRef.current.world, [pivot, bob, constraint])

          return {
            success: true,
            message: `Added a ${
              color || 'colorful'
            } pendulum! Watch it swing back and forth. The period depends on length, not mass!`,
          }
        },
      },

      addDoublePendulum: {
        description:
          'Add a double pendulum to demonstrate chaotic motion! Small changes in starting position create wildly different patterns.',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description:
                'The x position of the pivot point (default is center)',
            },
            y: {
              type: 'number',
              description:
                'The y position of the pivot point (default is near top)',
            },
            length: {
              type: 'number',
              description:
                'Length of each pendulum segment (40-120, default is 80)',
            },
          },
        },
        handler: async ({ x, y, length = 80 }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const Constraint = Matter.Constraint

          const segmentLength = clamp(length ?? 80, 40, 120)
          const bobRadius = 15

          const pivotX =
            typeof x === 'number'
              ? clamp(
                  x,
                  boundaryThickness + 100,
                  canvasWidth - boundaryThickness - 100
                )
              : canvasWidth / 2

          const pivotY =
            typeof y === 'number'
              ? clamp(
                  y,
                  boundaryThickness + 50,
                  canvasHeight - boundaryThickness - segmentLength * 2 - 100
                )
              : boundaryThickness + 100

          // Create pivot point

          const pivot = Bodies.circle(pivotX, pivotY, 5, {
            isStatic: true,
            render: {
              fillStyle: '#1f2937',
            },
            label: 'double-pendulum-pivot',
          })

          // First bob (starts at angle)

          const bob1X = pivotX + segmentLength * Math.sin(Math.PI / 4)
          const bob1Y = pivotY + segmentLength * Math.cos(Math.PI / 4)

          const bob1 = Bodies.circle(bob1X, bob1Y, bobRadius, {
            density: 0.04,
            frictionAir: 0.002,
            render: {
              fillStyle: colors[3], // blue
            },
            label: 'double-pendulum-bob1',
          })

          // Second bob (continues downward)

          const bob2X = bob1X + segmentLength * Math.sin(Math.PI / 6)
          const bob2Y = bob1Y + segmentLength * Math.cos(Math.PI / 6)

          const bob2 = Bodies.circle(bob2X, bob2Y, bobRadius, {
            density: 0.04,
            frictionAir: 0.002,
            render: {
              fillStyle: colors[4], // purple
            },
            label: 'double-pendulum-bob2',
          })

          // Constraint from pivot to first bob

          const constraint1 = Constraint.create({
            bodyA: pivot,
            bodyB: bob1,
            stiffness: 1,
            length: segmentLength,
            render: {
              strokeStyle: '#1f2937',
              lineWidth: 2,
            },
          })

          // Constraint from first bob to second bob

          const constraint2 = Constraint.create({
            bodyA: bob1,
            bodyB: bob2,
            stiffness: 1,
            length: segmentLength,
            render: {
              strokeStyle: '#1f2937',
              lineWidth: 2,
            },
          })

          Composite.add(engineRef.current.world, [
            pivot,
            bob1,
            bob2,
            constraint1,
            constraint2,
          ])

          return {
            success: true,
            message:
              'Added a double pendulum! Watch the chaotic motion - it never repeats exactly!',
          }
        },
      },

      addSpring: {
        description:
          "Add a spring to demonstrate Hooke's Law, oscillation, and elastic potential energy! Springs can be vertical or horizontal.",
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description:
                'The x position of the spring anchor (default is center)',
            },
            y: {
              type: 'number',
              description:
                'The y position of the spring anchor (default is upper part)',
            },
            stiffness: {
              type: 'number',
              description:
                'Spring stiffness/strength (0.001-0.1, default is 0.01)',
            },
            length: {
              type: 'number',
              description: 'Rest length of the spring (50-200, default is 100)',
            },
            mass: {
              type: 'number',
              description:
                'Mass of the attached object (10-40, default is 20 for radius)',
            },
            orientation: {
              type: 'string',
              description:
                'Spring orientation: "vertical" (hangs down) or "horizontal" (extends right), default is vertical',
            },
            color: {
              type: 'string',
              description:
                'Color of the mass (red, orange, green, blue, purple, pink, or hex)',
            },
          },
        },
        handler: async ({
          x,
          y,
          stiffness = 0.01,
          length = 100,
          mass = 20,
          orientation = 'vertical',
          color,
        }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const { canvasWidth, canvasHeight, boundaryThickness } = getSafeArea()

          const Constraint = Matter.Constraint

          const springStiffness = clamp(stiffness ?? 0.01, 0.001, 0.1)
          const springLength = clamp(length ?? 100, 50, 200)
          const objectRadius = clamp(mass ?? 20, 10, 40)
          const isVertical =
            (orientation || 'vertical').toLowerCase() === 'vertical'

          const anchorX =
            typeof x === 'number'
              ? clamp(
                  x,
                  boundaryThickness + 100,
                  canvasWidth - boundaryThickness - 100
                )
              : canvasWidth / 2

          const anchorY =
            typeof y === 'number'
              ? clamp(
                  y,
                  boundaryThickness + 50,
                  canvasHeight - boundaryThickness - springLength - 100
                )
              : boundaryThickness + 100

          const colorMap = {
            red: colors[0],
            orange: colors[1],
            green: colors[2],
            blue: colors[3],
            purple: colors[4],
            pink: colors[5],
          }

          const objectColor =
            colorMap[color?.toLowerCase()] ||
            color ||
            colors[Math.floor(Math.random() * colors.length)]

          // Create anchor point

          const anchor = Bodies.circle(anchorX, anchorY, 5, {
            isStatic: true,
            render: {
              fillStyle: '#1f2937',
            },
            label: 'spring-anchor',
          })

          // Calculate object position based on orientation

          const objectX = isVertical ? anchorX : anchorX + springLength
          const objectY = isVertical ? anchorY + springLength : anchorY

          // Create mass object

          const object = Bodies.circle(objectX, objectY, objectRadius, {
            density: 0.04,
            frictionAir: 0.02,
            render: {
              fillStyle: objectColor,
            },
            label: 'spring-mass',
          })

          // Create spring constraint
          const spring = Constraint.create({
            bodyA: anchor,
            bodyB: object,
            stiffness: springStiffness,
            damping: 0.01,
            length: springLength,
            render: {
              strokeStyle: '#059669',
              lineWidth: 3,
              type: 'spring',
            },
          })

          Composite.add(engineRef.current.world, [anchor, object, spring])

          let stiffnessDesc = ''

          if (springStiffness < 0.01) {
            stiffnessDesc = 'soft/weak spring'
          } else if (springStiffness < 0.05) {
            stiffnessDesc = 'medium spring'
          } else {
            stiffnessDesc = 'stiff/strong spring'
          }

          return {
            success: true,
            message: `Added a ${stiffnessDesc}! Pull it and watch it oscillate. The spring force equals k × displacement!`,
          }
        },
      },

      setDamping: {
        description:
          'Change air resistance/damping to show how energy is lost over time. Use this to demonstrate real-world friction effects.',
        parameters: {
          type: 'object',
          properties: {
            damping: {
              type: 'number',
              description:
                'Air resistance value (0 = no resistance/vacuum, 0.1 = high resistance, default is 0.01)',
            },
          },
          required: ['damping'],
        },
        handler: async ({ damping }) => {
          if (!engineRef.current) {
            return { success: false, error: 'Physics engine not initialized' }
          }

          const newDamping = clamp(damping ?? 0.01, 0, 0.1)
          const allBodies = Composite.allBodies(engineRef.current.world)
          const dynamicBodies = allBodies.filter((body) => !body.isStatic)

          dynamicBodies.forEach((body) => {
            body.frictionAir = newDamping
          })

          let description = ''

          if (newDamping < 0.005) {
            description =
              'Almost no air resistance - like in a vacuum! Objects will swing for a long time.'
          } else if (newDamping < 0.03) {
            description = 'Normal air resistance - objects gradually slow down.'
          } else {
            description =
              'High air resistance - objects slow down quickly like moving through water!'
          }

          return {
            success: true,
            damping: newDamping,
            message: `Air resistance set to ${newDamping}. ${description}`,
          }
        },
      },
    }
  }, [widget])

  return (
    <>
      <Head>
        <title>Physics Playground - ChatBotKit</title>
      </Head>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"
        onLoad={() => setMatterLoaded(true)}
      />
      <SideBySidePage className="bg-gray-100">
        <div className="w-full h-full relative">
          <div
            ref={canvasRef}
            className="w-full h-full overflow-hidden rounded-xl shadow-lg"
          />
        </div>
        <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg bg-white">
          <chatbotkit-widget
            class="flex-1 w-full h-full"
            widget="/examples/physics-playground/frame"
          />
          <div
            className={clsx(
              'absolute inset-0 flex items-center justify-center',
              {
                hidden: !!widget,
              }
            )}
          >
            <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
          </div>
        </div>
      </SideBySidePage>
    </>
  )
}

// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Physics Playground"
      description="An interactive physics playground where kids can learn about physics by creating balls, boxes, and experimenting with gravity through chat!"
      slug="physics-playground"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource(
    './pages/examples/physics-playground/demo/index.jsx'
  )

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
