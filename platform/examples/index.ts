import blueprints from '@/examples/catalogue/blueprints.yaml'
import demos from '@/examples/catalogue/demos.yaml'
import hub from '@/examples/catalogue/hub.yaml'
import projects from '@/examples/catalogue/projects.yaml'
import widgets from '@/examples/catalogue/widgets.yaml'

export type Example = (typeof widgets)[0]

const all: Example[] = [...widgets, ...blueprints, ...demos, ...projects, ...hub]

export default all
