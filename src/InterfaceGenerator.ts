/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";

export default class InterfaceGenerator {
  private accumulatedInterfaces: string;
  private generatedStructures: Record<string, string>;
  private interfaceNames: Set<string>;
  private jsonVariations: any[];
  private readonly name: string;
  private readonly dirPath: string;
  private readonly backupOldFile: boolean;

  public constructor(name: string, dirPath: string, backupOldFile: boolean, jsonVariations?: any[]) {
    if (!jsonVariations) {
      this.jsonVariations = [];
    } else {
      this.jsonVariations = jsonVariations;
    }

    this.name = name;
    this.dirPath = dirPath;
    this.backupOldFile = backupOldFile;

    this.accumulatedInterfaces = "";
    this.generatedStructures = {};
    this.interfaceNames = new Set();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public addJsonVariation(json: any): void {
    this.jsonVariations.push(json);
  }

  public generateInterfaces(): void {
    const mergedData = this.mergeJsonVariations(this.jsonVariations);

    this.generateInterfaceFromData(mergedData, this.name);

    this.writeInterfacesToFile();

    console.log(`Generated interfaces for ${this.name} in ${this.dirPath}`);
  }

  private mergeJsonVariations(variations: any[]): any {
    const merged: any = {};

    // Collect all keys from all variations
    const allKeys = new Set(variations.flatMap((obj) => Object.keys(obj)));

    allKeys.forEach((key) => {
      const values = variations.map((variation) => variation[key]).filter((v) => v !== undefined);

      if (values.length > 0) {
        if (typeof values[0] === "object" && !Array.isArray(values[0]) && values[0] !== null) {
          // If it's an object, recursively merge all objects for this key
          merged[key] = this.mergeJsonVariations(values);
        } else if (Array.isArray(values[0])) {
          // Handle arrays of objects
          const mergedArray = values.reduce((acc, arr) => {
            return acc.concat(arr); // Concatenate all arrays
          }, []);

          // Check if the array is of objects, and merge them if necessary
          if (typeof mergedArray[0] === "object" && mergedArray[0] !== null) {
            const mergedObject = this.mergeJsonVariations(mergedArray);
            merged[key] = [mergedObject]; // Array of objects with optional fields
          } else {
            // If it's an array of primitives
            const types = new Set(mergedArray.map((item: any) => typeof item));
            merged[key] = types.size > 1 ? Array.from(types).join(" | ") + "[]" : `${Array.from(types)[0]}[]`;
          }
        } else {
          // For primitives, use the first value as the base type
          merged[key] = values[0];
        }
      }

      // Mark the field as optional if it's missing in some variations
      if (values.length < variations.length) {
        merged[key + "?"] = merged[key];
        delete merged[key];
      }
    });

    return merged;
  }

  private getFieldType(value: any, parentName: string, fieldName: string): string {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        // Handle arrays of objects
        if (typeof value[0] === "object" && value[0] !== null) {
          // Generate a single interface for the merged object
          const nestedInterfaceName = this.getNestedInterfaceName(parentName, fieldName);
          this.generateInterfaceFromData(value[0], nestedInterfaceName);
          return `${nestedInterfaceName}[]`; // Return array of merged interface
        } else {
          // If it's an array of primitives, return the type of the first element
          const types = new Set(value.map((item) => typeof item));
          if (types.size > 1) {
            return Array.from(types).join(" | ") + "[]"; // Union of all types in the array
          } else {
            return `${Array.from(types)[0]}[]`; // Homogeneous array
          }
        }
      }
      console.warn(
        `The array at ${parentName}.${fieldName} is empty. Generated type will be 'unknown[]'. Consider adding variations with data for this field.`,
      );
      return "unknown[]";
    } else if (typeof value === "object" && value !== null) {
      // Generate a structure signature to detect duplicate structures
      const structureSignature = this.getStructureSignature(value);

      // Check if we've already generated an interface for this structure
      if (this.generatedStructures[structureSignature]) {
        return this.generatedStructures[structureSignature]; // Reuse the existing interface name
      } else {
        // Merge objects across variations
        const mergedObject = this.mergeJsonVariations([value]);

        // Generate the interface fields
        const interfaceFields = Object.keys(mergedObject)
          .map((key) => {
            return `${key}: ${this.getFieldType(mergedObject[key], parentName, key)};`;
          })
          .join("\n  ");

        // Create the interface string
        const nestedInterfaceName = this.getNestedInterfaceName(parentName, fieldName);
        const interfaceString = `export interface ${nestedInterfaceName} {\n  ${interfaceFields}\n}\n`;

        // Accumulate the generated interface
        this.accumulatedInterfaces += interfaceString;
        this.generatedStructures[structureSignature] = nestedInterfaceName;
        return nestedInterfaceName;
      }
    } else if (value === "undefined[]") {
      console.warn(
        `The array at ${parentName}.${fieldName} is empty. Generated type will be 'unknown[]'. Consider adding variations with data for this field.`,
      );
      return "unknown[]";
    }
    return typeof value;
  }

  private generateInterfaceFromData(data: any, interfaceName: string): void {
    const f = Object.keys(data).map((key) => `${key}: ${this.getFieldType(data[key], interfaceName, key)};`);

    const fields = f.join("\n  ");

    const interfaceString = `\nexport interface ${interfaceName} {\n  ${fields}\n}\n`;

    this.accumulatedInterfaces += interfaceString;
  }

  private getStructureSignature(obj: any): string {
    return Object.keys(obj)
      .map((key) => `${key}:${typeof obj[key]}`)
      .join("|");
  }

  private getNestedInterfaceName(parentName: string, fieldName: string): string {
    fieldName = fieldName.replace(/\?$/, "");
    let interfaceName = `${parentName}_${fieldName}`;
    while (this.interfaceNames.has(interfaceName)) {
      const num = this.getNumberFromInterfaceName(interfaceName);
      interfaceName = `${parentName}_${fieldName}_${num + 1}`;
    }
    this.interfaceNames.add(interfaceName);
    return interfaceName;
  }

  private getNumberFromInterfaceName(interfaceName: string): number {
    const interfaceNameParts = interfaceName.split("_");
    if (interfaceNameParts.length == 3) {
      return Number(interfaceName.split("_")[2]);
    }
    return 0;
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  private writeInterfacesToFile(): void {
    const fileName = `${this.capitalizeFirstLetter(this.name)}.ts`;
    const filePath = `${this.dirPath}/${fileName}`;

    if (this.backupOldFile && fs.existsSync(filePath)) {
      // File already exists, backup
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "_");
      fs.copyFileSync(filePath, `${filePath}.${timestamp}.bak`);
    }

    fs.writeFileSync(filePath, `// Generated by multi-json-to-ts\n\n${this.accumulatedInterfaces}`);
  }
}
