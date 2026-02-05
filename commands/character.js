import chalk from 'chalk';
import inquirer from 'inquirer';
import ApiClient from '../api/client.js';
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

  static async getUserStats() {
    try {
      const apiClient = new ApiClient();
      const stats = await apiClient.getUserStats();
      return {
        level: stats.character?.stats?.level || 1,
        experience_gained: stats.character?.stats?.experience || 0
      };
    } catch (error) {
      // Return default values on error
      return { level: 1, experience_gained: 0 };
    }
  }

  // Touch config file to trigger extension refresh
  static touchConfigFile() {
    try {
      const configDir = path.join(os.homedir(), '.commitquest');
      const configPath = path.join(configDir, 'config.json');
      
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      let config = {};
      if (fs.existsSync(configPath)) {
        // Read current content
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      
      // Add a timestamp to ensure the file actually changes
      config._lastUpdated = new Date().toISOString();
      config._extensionVersion = '1.0.0';
      
      // Write it back to update the file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.gray('🔄 Extension refreshed'));
      
    } catch (error) {
      // Log error but don't fail - this is not critical
      console.debug('Failed to touch config file:', error.message);
    }
  }

  static async editCharacter() {
    try {
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

      // Get all available character classes and species
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
      // Ask for new name
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

      // Ask if they want to change class
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

      // Ask if they want to change species
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

      // Update character
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

      // Trigger extension refresh
      this.touchConfigFile();

      return updatedCharacter;
    } catch (error) {
      throw new Error(`Character editing failed: ${error.message}`);
    }
  }

  static async displayCharacter() {
    try {
      const apiClient = new ApiClient();
      const character = await apiClient.getCharacter();
      
      if (!character) {
        console.log(chalk.yellow('ℹ️  You don\'t have a character yet.'));
        return null;
      }

      // Get user stats for level/experience
      const userStats = await this.getUserStats();

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
    } catch (error) {
      throw new Error(`Failed to display character: ${error.message}`);
    }
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
    // Convert to lowercase for case-insensitive matching
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
    // Convert to lowercase for case-insensitive matching
    const normalizedName = speciesName.toLowerCase();
    return emojiMap[normalizedName] || emojiMap.default;
  }
  

  static async listAvailableCombinations() {
    try {
      const apiClient = new ApiClient();
      const classes = await apiClient.getCharacterClasses();
      
      console.log(chalk.blue.bold('🎭 Available Character Classes\n'));
      
      classes.forEach((class_, index) => {
        console.log(chalk.cyan(`${index + 1}. ${this.getClassEmoji(class_.name)} ${class_.name}`));
        console.log(chalk.gray(`   ${class_.description}`));
        
        console.log('');
      });
      
      return classes;
    } catch (error) {
      throw new Error(`Failed to list character classes: ${error.message}`);
    }
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
    console.error(chalk.red('❌ Failed to display character:'), error.message);
    process.exit(1);
  }
}

export default characterCommand;
export { CharacterService }; 