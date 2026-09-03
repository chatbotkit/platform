import { useContext, useEffect } from 'react'

import abilities from '@/data/abilities/visible'

import prisma from '@/prisma/client'
import { DatasetVisibility, SkillsetVisibility } from '@/prisma/enums'

import { toSlug } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'
import { getTemplate, isTemplateName } from '@/lib/template'

import Wizard, { wizardContext } from '@/layouts/Wizard'
import { Heading, NavigationButtons } from '@/layouts/Wizard'

import DynamicIcon from '@/components/DynamicIcon'
import List, { ListItem } from '@/components/List'

import examples from '@/examples'

export default function Page({ example }) {
  const { setOptions } = useContext(wizardContext)

  useEffect(() => {
    setOptions((prev) => {
      return {
        ...prev,

        example: example,
      }
    })
  }, [example, setOptions])

  return (
    <>
      <Heading
        title="Select an example"
        description="We use this information to tailor your chatbot capabilities and look and feel."
      />
      <div>
        <List>
          <ListItem
            className="cursor-default"
            icon={
              <DynamicIcon
                className="w-16 h-16 text-6xl pt-2"
                icon={example.icon}
              />
            }
            title={example.title}
            body={example.description}
          />
        </List>
      </div>
      <NavigationButtons />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Create Solution"
      title="Example"
      description="We use this information to tailor your chatbot capabilities and look and feel."
    >
      {children}
    </Wizard>
  )
}

export async function getServerSideProps(context) {
  const example = examples.find((item) => {
    return (
      item.slug === context.query.example ||
      toSlug(item.title) === context.query.example
    )
  })

  if (!example) {
    return {
      notFound: true,
    }
  }

  // @note a hub example is a pointer, not a copy - the entry carries no
  // resources of its own, only a reference to a published hub page, so there is
  // nothing here to clone. The hub already clones its own pages (templates/hub,
  // reached from /hub/<type>s/<ref>), so hand the wizard over to that template
  // instead of duplicating it. Every path that picks an example lands on this
  // step - the browse step and the ?example=<slug> deep link alike - so this is
  // the one place the handoff has to happen.
  //
  // The hub step resolves the ref by slug or id and names its query param after
  // the resource type, the same way the hub page links into the wizard.
  if (example.hub) {
    const {
      template: _template,
      templateId: _templateId,
      example: _exampleSlug,
      ...query
    } = context.query

    return {
      redirect: {
        destination: `/new?${new URLSearchParams({
          ...query,

          template: 'hub',

          [`${example.hub.type}Id`]: example.hub.ref,
        })}`,
        permanent: false,
      },
    }
  }

  if (example.dataset) {
    example.dataset = { ...example.dataset }

    if (example.dataset.id) {
      const dataset = await prisma.dataset.findFirst({
        where: {
          id: example.dataset.id,
          visibility: DatasetVisibility.public,
        },

        select: {
          name: true,
          description: true,
        },
      })

      delete example.dataset.id

      if (dataset) {
        Object.assign(example.dataset, dataset)
      }
    }
  }

  if (example.skillset) {
    example.skillset = { ...example.skillset }

    if (example.skillset.id) {
      const skillset = await prisma.skillset.findFirst({
        where: {
          id: example.skillset.id,
          visibility: SkillsetVisibility.public,
        },

        select: {
          name: true,
          description: true,

          abilities: {
            select: {
              name: true,
              description: true,

              instruction: true,
            },
          },
        },
      })

      delete example.skillset.id

      if (skillset) {
        Object.assign(example.skillset, skillset)
      }
    }

    if (example.skillset.abilities) {
      example.skillset.abilities = example.skillset.abilities.map((ability) => {
        ability = { ...ability }

        if (isTemplateName(ability.instruction)) {
          const template = getTemplate(ability.instruction, abilities)

          ability.instruction = template.instruction
        }

        return ability
      })
    }
  }

  return {
    props: makeJsonSafe(
      {
        example,
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}
