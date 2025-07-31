# @honestjs/cli

The official command-line interface for scaffolding and managing HonestJS projects.

## Installation

To install the CLI globally, run:

```bash
npm install -g @honestjs/cli
```

## Usage

The HonestJS CLI provides several commands to help you get started with your project.

### `new`

The `new` command creates a new HonestJS project with a default structure and configuration.

```bash
honestjs new <project-name> [options]

honest new <project-name> [options]

hnjs new <project-name> [options]
```

**Arguments**

- `<project-name>`: The name of the project to create.

**Options**

- `-t, --template <template>`: Specify the template to use (e.g., `barebone`, `blank`, `mvc`).
- `-p, --package-manager <manager>`: Choose a package manager (e.g., `bun`, `npm`, `yarn`, `pnpm`).
- `--typescript`: Use TypeScript in the project.
- `--no-typescript`: Do not use TypeScript in the project.
- `--eslint`: Add ESLint for code linting.
- `--no-eslint`: Do not add ESLint.
- `--prettier`: Add Prettier for code formatting.
- `--no-prettier`: Do not add Prettier.
- `--docker`: Add Docker configuration.
- `--no-docker`: Do not add Docker configuration.
- `--git`: Initialize a Git repository.
- `--no-git`: Do not initialize a Git repository.
- `--install`: Install dependencies after creating the project.
- `--no-install`: Do not install dependencies.
- `-y, --yes`: Skip all prompts and use default settings.

### `list`

The `list` command displays all available templates that can be used to create a new project.

```bash
honestjs list [options]
```

**Options**

- `-j, --json`: Output the list of templates in JSON format.
- `-c, --category <category>`: Filter templates by category.
- `-t, --tag <tag>`: Filter templates by tag.

### `info`

The `info` command shows information about the CLI, templates, and your environment.

```bash
honestjs info
```

### `generate`

The `generate` command (aliased as `g`) creates new files based on a schematic.

```bash
honestjs generate <schematic> <name> [options]
```

**Arguments**

- `<schematic>`: The type of file to generate (e.g., `controller`, `service`, `module`).
- `<name>`: The name of the generated item.

**Options**

- `-p, --path <path>`: Specify the path where the file should be created.
- `-f, --flat`: Create the file in a flat structure (without a dedicated folder).
- `--skip-import`: Do not import the generated item into other files.
- `--export`: Export the generated item.

**Available Schematics**

- `controller` (or `c`): Generates a new controller.
- `service` (or `s`): Generates a new service.
- `module` (or `m`): Generates a new module.
- `view` (or `v`): Generates a new view.
- `middleware` (or `c-m`): Generates a new middleware.
- `guard` (or `c-g`): Generates a new guard.
- `filter` (or `c-f`): Generates a new filter.
- `pipe` (or `c-p`): Generates a new pipe.

## License

This project is licensed under the MIT License.
