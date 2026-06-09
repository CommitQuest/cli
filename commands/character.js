import chalk from 'chalk';
import inquirer from 'inquirer';
import ApiClient from '../api/client.js';
import { handleCommandError } from './ui.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

    const currentCharacter = await apiClient.getCharacter();

    if (!currentCharacter) {
      console.log(chalk.yellow('\n🎭 You don\'t have a character yet!'));
      console.log(chalk.gray('Let\'s create one now.\n'));

      const [classes, species] = await Promise.all([
        apiClient.getCharacterClasses(),
        apiClient.getSpecies()
      ]);

      if (classes.length === 0 || species.length === 0) {
        throw new Error('No character classes or species available. Please contact support.');
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter your character name:',
          validate: input => input.trim().length > 0 || 'Name cannot be empty'
        },
        {
          type: 'list',
          name: 'speciesId',
          message: 'Select a species:',
          choices: species.map(s => ({ name: s.name, value: s.id }))
        },
        {
          type: 'list',
          name: 'classId',
          message: 'Select a class:',
          choices: classes.map(c => ({ name: c.name, value: c.id }))
        }
      ]);

      const newChar = await apiClient.createCharacter(answers.name, answers.classId, answers.speciesId);
      console.log(chalk.green('\n✅ Character created successfully!'));
      console.log(chalk.cyan(`🧝 Name: ${answers.name}`));
      console.log(chalk.cyan(`🧬 Species: ${species.find(s => s.id === answers.speciesId).name}`));
      console.log(chalk.cyan(`🛡️ Class: ${classes.find(c => c.id === answers.classId).name}`));
      this.touchConfigFile();
      return newChar;
    }

    console.log(chalk.blue.bold('✏️  Edit Your Character\n'));
    console.log(chalk.gray('Current character:'));
    console.log(chalk.cyan(`Name: ${currentCharacter.name}`));
    
    if (currentCharacter.classes) {
      const className = currentCharacter.classes.name;
      console.log(chalk.cyan(`Class: ${this.getClassEmoji(className)} ${className}`));
    }
    
    if (currentCharacter.species) {
      const speciesName = currentCharacter.species.name;
      console.log(chalk.cyan(`Species: ${this.getSpeciesEmoji(speciesName)} ${speciesName}`));
    }
    
    console.log('');

    const [classes, species] = await Promise.all([
      apiClient.getCharacterClasses(),
      apiClient.getSpecies()
    ]);

    if (classes.length === 0) {
      throw new Error('No character classes available. Please contact support.');
    }

    if (species.length === 0) {
      throw new Error('No species available. Please contact support.');
    }

    const { changeName } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'changeName',
        message: 'Would you like to change your name?',
        default: false
      }
    ])

    let name = currentCharacter.name
    if (changeName) {
      const { characterName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'characterName',
          message: 'Enter new character name:',
          default: currentCharacter.name
        }
      ]);
      name = characterName
    }

    const { changeClass } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'changeClass',
        message: 'Would you like to change your character class?',
        default: false
      }
    ]);

    let selectedClassId = null;
    if (changeClass) {
      console.log(chalk.yellow.bold('\nChoose your new class:\n'));
      const classChoices = classes.map((c, index) => ({
        name: `${index + 1}. ${this.getClassEmoji(c.name)} ${c.name} - ${chalk.gray(c.description)}`,
        value: c.id
      }));

      const { selectedClassId: newClassId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedClassId',
          message: 'Select your new class:',
          choices: classChoices
        }
      ]);
      selectedClassId = newClassId;
    }

    const { changeSpecies } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'changeSpecies',
        message: 'Would you like to change your character species?',
        default: false
      }
    ]);

    let selectedSpeciesId = null;
    if (changeSpecies) {
      console.log(chalk.yellow.bold('\nChoose your new species:\n'));
      const speciesChoices = species.map((s, index) => ({
        name: `${index + 1}. ${this.getSpeciesEmoji(s.name)} ${s.name} - ${chalk.gray(s.description)}`,
        value: s.id
      }));

      const { selectedSpeciesId: newSpeciesId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSpeciesId',
          message: 'Select your new species:',
          choices: speciesChoices
        }
      ]);
      selectedSpeciesId = newSpeciesId;
    }

    const updatedCharacter = await apiClient.updateCharacter(
      name, 
      selectedClassId, 
      selectedSpeciesId
    );

    console.log(chalk.green.bold('\n🎉 Character updated successfully!\n'));
    console.log(chalk.cyan(`👤 Name: ${updatedCharacter.name}`));
    
    if (updatedCharacter.classes) {
      const className = updatedCharacter.classes.name;
      console.log(chalk.cyan(`⚔️  Class: ${className}`));
    }
    
    if (updatedCharacter.species) {
      const speciesName = updatedCharacter.species.name;
      console.log(chalk.cyan(`🧬 Species: ${speciesName}`));
    }

    this.touchConfigFile();

    return updatedCharacter;
  }

  static async displayCharacter() {
    const apiClient = new ApiClient();
    const character = await apiClient.getCharacter();
    
    if (!character) {
      console.log(chalk.yellow('ℹ️  You don\'t have a character yet.'));
      return null;
    }

    console.log(chalk.blue.bold('👤 Your Character\n'));
    console.log(chalk.cyan(`Name: ${character.name}`));
    
    if (character.classes && character.species) {
      const className = character.classes.name;
      const speciesName = character.species.name;
      console.log(chalk.cyan(`Class: ${this.getClassEmoji(className)} ${className}`));
      console.log(chalk.cyan(`Species: ${this.getSpeciesEmoji(speciesName)} ${speciesName}`));
    } else {
      console.log(chalk.cyan(`Class: ${this.getClassEmoji('default')} Unknown`));
    }

    return character;
  }

  static getClassEmoji(className) {
    const emojiMap = {
      'wizard': '🔮',
      'warrior': '⚔️',
      'rogue': '🗡️',
      'scout': '🏃‍♂️',
      'cleric': '⛪',
      'ranger': '🏹',
      'paladin': '🛡️',
      'bard': '🎵',
      'monk': '🥋',
      'druid': '🌿',
      'sorcerer': '✨',
      'warlock': '👹',
      'barbarian': '🪓',
      'fighter': '⚔️',
      'default': '⚔️'
    };
    const normalizedName = className.toLowerCase();
    return emojiMap[normalizedName] || emojiMap.default;
  }

  static getSpeciesEmoji(speciesName) {
    const emojiMap = {
      'human': '👤',
      'elf': '🧚‍♀️',
      'dwarf': '🧒',
      'orc': '👹',
      'lizardfolk': '🦎',
      'default': '👤'
    };
    const normalizedName = speciesName.toLowerCase();
    return emojiMap[normalizedName] || emojiMap.default;
  }
  
  static async listAvailableCombinations() {
    const apiClient = new ApiClient();
    const classes = await apiClient.getCharacterClasses();
    
    console.log(chalk.blue.bold('🎭 Available Character Classes\n'));
    
    classes.forEach((class_, index) => {
      console.log(chalk.cyan(`${index + 1}. ${this.getClassEmoji(class_.name)} ${class_.name}`));
      console.log(chalk.gray(`   ${class_.description}`));
      
      console.log('');
    });
    
    return classes;
  }
}

async function characterCommand() {
  try {
    const character = await CharacterService.displayCharacter();
    
    if (!character) {
      console.log(chalk.yellow('\n🎭 You don\'t have a character yet!'));
      console.log(chalk.gray('Create one to start your adventure:'));
      console.log(chalk.cyan('  commitquest character edit'));
    }
    
  } catch (error) {
    handleCommandError(error, { label: 'Failed to display character.' });
  }
}

export default characterCommand;
export { CharacterService };
