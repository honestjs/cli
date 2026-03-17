# @honestjs/cli

The official command-line interface for scaffolding and managing HonestJS projects.

## Installation

To install the CLI globally, run:

```bash
bun add -g @honestjs/cli
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

- `-t, --template <template>`: Template name (e.g., `barebone`, `blank`, `mvc`) or local path (`./path`,
  `~/path`).
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
- `--offline`: Use cached templates only (no network).
- `--refresh-templates`: Force refresh template cache before use.

**Local templates:** Use a local path for `--template` to scaffold from a local templates repo or single template
directory. Examples: `honestjs new my-app -t ./templates -y`, `honestjs new my-app -t ~/company/templates -y`.

### `list`

The `list` command displays all available templates that can be used to create a new project.

```bash
honestjs list [options]
```

**Options**

- `-j, --json`: Output the list of templates in JSON format.
- `-c, --category <category>`: Filter templates by category.
- `-t, --tag <tag>`: Filter templates by tag.
- `-l, --local <path>`: List templates from a local path (repo root or single template).
- `--offline`: Use cached templates only (no network).
- `--refresh-templates`: Force refresh template cache before use.

### `info`

The `info` command shows information about the CLI, templates, and your environment.

```bash
honestjs info
honestjs info --local ./templates
```

**Options**

- `-l, --local <path>`: Show templates from a local path instead of remote.

### `doctor`

The `doctor` command diagnoses your environment: runtime (Node/Bun), Git, package managers, template cache, and network
connectivity.

```bash
honestjs doctor
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
- `--force`: Overwrite existing files without prompting.
- `--dry-run`: Show what would be created without writing files.
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
