import chalk from 'chalk';
import inquirer from 'inquirer';
import ApiClient from '../api/client.js';
import { handleCommandError } from './ui.js';
import {
  compactBanner,
  box,
  characterPortrait,
  sectionTitle,
  getClassArt,
  getSpeciesGlyph,
  successBanner,
  warnBanner,
  infoHint,
  palette,
  sparkleLine,
  settingsRow,
  columns,
  actionBar,
} from './theme.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function validateCharacterName(input) {
  const name = String(input || '').trim();
  if (!name) return 'Name cannot be empty';
  if (name.length > 32) return 'Name must be 32 characters or fewer';
  if (!/^[A-Za-z0-9 _'-]+$/.test(name)) {
    return 'Name may only contain letters, numbers, spaces, apostrophes, underscores, and hyphens';
  }
  return true;
}

function findById(list, id) {
  return list.find((item) => item.id === id) || null;
}

function truncate(text, max = 42) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

class CharacterService {
  static async hasCharacter() {
    try {
      const apiClient = new ApiClient();
      const character = await apiClient.getCharacter();
      return character !== null;
    } catch (error) {
      return false;
    }
  }

  static touchConfigFile() {
    try {
      const configDir = path.join(os.homedir(), '.commitquest');
      const configPath = path.join(configDir, 'config.json');

      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      config._lastUpdated = new Date().toISOString();
      config._extensionVersion = '1.0.0';

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
      fs.chmodSync(configPath, 0o600);
    } catch (error) {
      console.debug('Failed to touch config file:', error.message);
    }
  }

  static async editCharacter() {
    const apiClient = new ApiClient();
    const currentCharacter = await apiClient.getCharacterOrNull();

    const [classes, species] = await Promise.all([
      apiClient.getCharacterClasses(),
      apiClient.getSpecies(),
    ]);

    if (classes.length === 0 || species.length === 0) {
      throw new Error('No character classes or species available. Please contact support.');
    }

    if (!currentCharacter) {
      return this.createCharacterWizard(apiClient, classes, species);
    }

    return this.editCharacterStudio(apiClient, currentCharacter, classes, species);
  }

  static async createCharacterWizard(apiClient, classes, species) {
    console.log('');
    console.log(warnBanner("You don't have a character yet!", ['Forge your hero in three quick steps.']));
    console.log('');
    console.log(sectionTitle('Character Creator', { width: 52, accent: 'teal' }));
    console.log('');
    console.log(infoHint('Use arrow keys · Enter to confirm · Ctrl+C to cancel'));
    console.log('');

    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Hero name:',
        validate: validateCharacterName,
      },
    ]);

    const speciesId = await this.promptSpecies(species);
    const classId = await this.promptClass(classes);

    const speciesName = findById(species, speciesId)?.name || 'Unknown';
    const className = findById(classes, classId)?.name || 'Unknown';

    console.log('');
    console.log(sectionTitle('Preview', { width: 48, accent: 'gold' }));
    console.log('');
    console.log(
      characterPortrait({
        name: name.trim(),
        classes: { name: className },
        species: { name: speciesName },
      })
    );
    console.log('');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Create this character?',
        default: true,
      },
    ]);

    if (!confirm) {
      console.log('');
      console.log(palette.mist('  Creation cancelled — no changes made.'));
      console.log('');
      return null;
    }

    const newChar = await apiClient.createCharacter(name, classId, speciesId);
    this.printCharacterCreated(name.trim(), speciesName, className);
    this.touchConfigFile();
    return newChar;
  }

  static async editCharacterStudio(apiClient, currentCharacter, classes, species) {
    const draft = {
      name: currentCharacter.name,
      classId: currentCharacter.classes?.id ?? currentCharacter.class_id ?? null,
      speciesId: currentCharacter.species?.id ?? currentCharacter.species_id ?? null,
    };

    const original = { ...draft };

    while (true) {
      console.log('');
      console.log(compactBanner('Character Studio'));
      console.log('');
      console.log(infoHint('Edit fields one at a time, preview live, then save'));
      console.log('');

      const previewClass = findById(classes, draft.classId)?.name
        || currentCharacter.classes?.name
        || 'Adventurer';
      const previewSpecies = findById(species, draft.speciesId)?.name
        || currentCharacter.species?.name
        || 'Unknown';

      const preview = characterPortrait({
        name: draft.name,
        classes: { name: previewClass },
        species: { name: previewSpecies },
      });

      const nameDirty = draft.name !== original.name;
      const classDirty = draft.classId !== original.classId;
      const speciesDirty = draft.speciesId !== original.speciesId;
      const dirty = nameDirty || classDirty || speciesDirty;

      const editorLines = [
        settingsRow('1', 'Name', draft.name, { dirty: nameDirty }),
        settingsRow(
          '2',
          'Class',
          `${this.getClassEmoji(previewClass)} ${previewClass}`,
          { dirty: classDirty }
        ),
        settingsRow(
          '3',
          'Species',
          `${this.getSpeciesEmoji(previewSpecies)} ${previewSpecies}`,
          { dirty: speciesDirty }
        ),
        '',
        dirty
          ? palette.amber('  ● Unsaved changes')
          : palette.stone('  ○ No changes yet'),
      ];

      const editorPanel = box(editorLines, {
        title: 'Editor',
        width: 40,
        style: 'double',
        color: 'gold',
      });

      console.log(columns(preview, editorPanel, { gap: 3, minWidth: 70 }));
      console.log('');
      console.log(
        actionBar(
          [
            ['1-3', 'edit field'],
            ['s', 'save'],
            ['p', 'preview'],
            ['x', 'exit'],
          ],
          { width: 56 }
        )
      );
      console.log('');

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          pageSize: 8,
          choices: [
            { name: `${nameDirty ? '●' : '○'} Edit name`, value: 'name' },
            { name: `${classDirty ? '●' : '○'} Change class`, value: 'class' },
            { name: `${speciesDirty ? '●' : '○'} Change species`, value: 'species' },
            new inquirer.Separator('──────────────'),
            {
              name: dirty
                ? chalk.green('Save changes')
                : chalk.gray('Save changes (nothing to save)'),
              value: 'save',
              disabled: dirty ? false : 'No changes',
            },
            { name: 'Preview only', value: 'preview' },
            { name: dirty ? 'Discard & exit' : 'Exit', value: 'exit' },
          ],
        },
      ]);

      if (action === 'name') {
        const { characterName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'characterName',
            message: 'Hero name:',
            default: draft.name,
            validate: validateCharacterName,
          },
        ]);
        draft.name = characterName.trim();
        continue;
      }

      if (action === 'class') {
        draft.classId = await this.promptClass(classes, draft.classId);
        continue;
      }

      if (action === 'species') {
        draft.speciesId = await this.promptSpecies(species, draft.speciesId);
        continue;
      }

      if (action === 'preview') {
        console.log('');
        console.log(sectionTitle('Live Preview', { width: 48, accent: 'teal' }));
        console.log('');
        console.log(
          characterPortrait({
            name: draft.name,
            classes: { name: previewClass },
            species: { name: previewSpecies },
          })
        );
        console.log('');
        await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: 'Press Enter to return to the editor',
          },
        ]);
        continue;
      }

      if (action === 'exit') {
        if (dirty) {
          const { discard } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'discard',
              message: 'Discard unsaved changes and exit?',
              default: false,
            },
          ]);
          if (!discard) continue;
        }
        console.log('');
        console.log(palette.mist('  Left Character Studio — no changes saved.'));
        console.log('');
        return currentCharacter;
      }

      if (action === 'save') {
        console.log('');
        console.log(sectionTitle('Confirm Changes', { width: 48, accent: 'emerald' }));
        console.log('');

        const changeLines = [];
        if (nameDirty) {
          changeLines.push(
            palette.mist('  Name    ') +
              palette.stone(original.name) +
              palette.stone(' → ') +
              palette.goldBright(draft.name)
          );
        }
        if (classDirty) {
          const from = findById(classes, original.classId)?.name || currentCharacter.classes?.name || '—';
          const to = findById(classes, draft.classId)?.name || '—';
          changeLines.push(
            palette.mist('  Class   ') +
              palette.stone(from) +
              palette.stone(' → ') +
              palette.goldBright(to)
          );
        }
        if (speciesDirty) {
          const from = findById(species, original.speciesId)?.name || currentCharacter.species?.name || '—';
          const to = findById(species, draft.speciesId)?.name || '—';
          changeLines.push(
            palette.mist('  Species ') +
              palette.stone(from) +
              palette.stone(' → ') +
              palette.goldBright(to)
          );
        }

        console.log(
          columns(
            characterPortrait({
              name: draft.name,
              classes: { name: previewClass },
              species: { name: previewSpecies },
            }),
            box(changeLines, { title: 'Diff', width: 36, style: 'round', color: 'emerald' }),
            { gap: 3, minWidth: 70 }
          )
        );
        console.log('');

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Apply these changes?',
            default: true,
          },
        ]);

        if (!confirm) continue;

        const updatedCharacter = await apiClient.updateCharacter(
          draft.name,
          classDirty ? draft.classId : null,
          speciesDirty ? draft.speciesId : null
        );

        console.log('');
        console.log(successBanner('Character updated!', ['Your hero sheet is ready.']));
        console.log('');
        console.log(characterPortrait(updatedCharacter));
        console.log('');

        this.touchConfigFile();
        return updatedCharacter;
      }
    }
  }

  static async promptClass(classes, selectedId = null) {
    console.log('');
    console.log(sectionTitle('Choose a class', { width: 52, accent: 'amber' }));
    console.log('');

    const { classId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'classId',
        message: 'Class:',
        pageSize: Math.min(12, classes.length + 2),
        default: selectedId ?? undefined,
        choices: classes.map((c) => ({
          name:
            `${this.getClassEmoji(c.name)} ${c.name}` +
            (c.id === selectedId ? chalk.gray('  (current)') : '') +
            chalk.gray(`  — ${truncate(c.description)}`),
          value: c.id,
          short: c.name,
        })),
      },
    ]);

    return classId;
  }

  static async promptSpecies(species, selectedId = null) {
    console.log('');
    console.log(sectionTitle('Choose a species', { width: 52, accent: 'teal' }));
    console.log('');

    const { speciesId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'speciesId',
        message: 'Species:',
        pageSize: Math.min(12, species.length + 2),
        default: selectedId ?? undefined,
        choices: species.map((s) => ({
          name:
            `${this.getSpeciesEmoji(s.name)} ${s.name}` +
            (s.id === selectedId ? chalk.gray('  (current)') : '') +
            chalk.gray(`  — ${truncate(s.description)}`),
          value: s.id,
          short: s.name,
        })),
      },
    ]);

    return speciesId;
  }

  static printCharacterCreated(name, speciesName, className) {
    console.log('');
    console.log(successBanner('Character created successfully!', []));
    console.log('');
    const art = getClassArt(className);
    const lines = [
      palette.goldBright(`  ${name}`),
      palette.stone('  ─────────────────'),
      ...art.map((line) => palette.teal(`  ${line}`)),
      '',
      palette.mist(`  ${getSpeciesGlyph(speciesName)} ${speciesName}`) +
        palette.stone('  ·  ') +
        palette.amber(className),
    ];
    console.log(box(lines, { title: '✦ Hero', width: 28, style: 'round', color: 'emerald' }));
    console.log('');
  }

  static async displayCharacter() {
    const apiClient = new ApiClient();
    let character;
    try {
      character = await apiClient.getCharacterOrNull();
    } catch (error) {
      if (error.response?.status === 401) {
        throw error;
      }
      console.log(palette.amber('ℹ️  Could not load character details right now.'));
      return null;
    }

    if (!character) {
      console.log(palette.amber("ℹ️  You don't have a character yet."));
      return null;
    }

    console.log('');
    console.log(compactBanner('Your Character'));
    console.log('');
    console.log(characterPortrait(character));
    console.log('');
    console.log(sparkleLine('Ready for the next commit quest'));
    console.log('');
    console.log(infoHint('Edit anytime with: commitquest character edit'));
    console.log('');

    return character;
  }

  static getClassEmoji(className) {
    const emojiMap = {
      wizard: '🔮',
      warrior: '⚔️',
      rogue: '🗡️',
      scout: '🏃',
      cleric: '⛪',
      ranger: '🏹',
      paladin: '🛡️',
      bard: '🎵',
      monk: '🥋',
      druid: '🌿',
      sorcerer: '✨',
      warlock: '👹',
      barbarian: '🪓',
      fighter: '⚔️',
      default: '⚔️',
    };
    const normalizedName = String(className || 'default').toLowerCase();
    return emojiMap[normalizedName] || emojiMap.default;
  }

  static getSpeciesEmoji(speciesName) {
    const emojiMap = {
      human: '👤',
      elf: '🧝',
      dwarf: '⛏️',
      orc: '👹',
      lizardfolk: '🦎',
      default: '👤',
    };
    const normalizedName = String(speciesName || 'default').toLowerCase();
    return emojiMap[normalizedName] || emojiMap.default;
  }

  static async listAvailableCombinations() {
    const apiClient = new ApiClient();
    const [classes, species] = await Promise.all([
      apiClient.getCharacterClasses(),
      apiClient.getSpecies(),
    ]);

    console.log('');
    console.log(compactBanner('Guild Codex'));
    console.log('');

    const classLines = [];
    if (classes.length === 0) {
      classLines.push(palette.amber('  No classes available right now.'));
    } else {
      classes.forEach((class_, index) => {
        const art = getClassArt(class_.name);
        classLines.push(
          palette.goldBright(`  ${index + 1}. ${this.getClassEmoji(class_.name)} ${class_.name}`)
        );
        classLines.push(palette.teal(`     ${art[1].trim()}`));
        classLines.push(palette.mist(`     ${truncate(class_.description, 48)}`));
        classLines.push('');
      });
    }

    console.log(box(classLines, { title: 'Classes', width: 52, style: 'double', color: 'gold' }));
    console.log('');

    const speciesLines = [];
    if (species.length === 0) {
      speciesLines.push(palette.amber('  No species available right now.'));
    } else {
      species.forEach((item, index) => {
        speciesLines.push(
          palette.goldBright(
            `  ${index + 1}. ${this.getSpeciesEmoji(item.name)} ${item.name}`
          )
        );
        speciesLines.push(palette.mist(`     ${truncate(item.description, 48)}`));
        speciesLines.push('');
      });
    }

    console.log(
      box(speciesLines, { title: 'Species', width: 52, style: 'round', color: 'teal' })
    );
    console.log('');
    console.log(infoHint('Open the studio with: commitquest character edit'));
    console.log('');

    return { classes, species };
  }
}

async function characterCommand() {
  try {
    const character = await CharacterService.displayCharacter();

    if (!character) {
      console.log('');
      console.log(
        warnBanner("You don't have a character yet!", [
          'Create one to start your adventure:',
          '',
          chalk.cyan('  commitquest character edit'),
        ])
      );
      console.log('');
    }
  } catch (error) {
    handleCommandError(error, { label: 'Failed to display character.' });
  }
}

export default characterCommand;
export { CharacterService };
