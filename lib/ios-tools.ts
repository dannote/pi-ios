/**
 * iOS-specific tools that use just-bash instead of spawning real processes.
 * These replace pi-agent's bash/grep/find tools for iOS.
 */

import { Bash } from "just-bash";

// Singleton bash instance with persistent filesystem
let bashInstance: Bash | null = null;

function getBash(): Bash {
  if (!bashInstance) {
    bashInstance = new Bash({
      cwd: '/home/user',
    });
  }
  return bashInstance;
}

/**
 * Execute a bash command using just-bash
 */
export async function bashTool(command: string, options?: { 
  cwd?: string;
  timeout?: number;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const bash = getBash();
  const result = await bash.exec(command, {
    cwd: options?.cwd,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

/**
 * Grep for patterns using just-bash's grep command
 */
export async function grepTool(
  pattern: string, 
  path: string = '.',
  options?: {
    ignoreCase?: boolean;
    literal?: boolean;
    context?: number;
    limit?: number;
    glob?: string;
  }
): Promise<{ output: string; matchCount: number }> {
  const bash = getBash();
  
  // Build grep command (use grep -r for recursive search)
  // Note: Don't use -- separator as it may not be supported
  let cmd = 'grep -rn';
  if (options?.ignoreCase) cmd += ' -i';
  if (options?.literal) cmd += ' -F';
  if (options?.context) cmd += ` -C ${options.context}`;
  
  // Escape pattern for shell
  const escapedPattern = pattern.replace(/'/g, "'\\''");
  cmd += ` '${escapedPattern}' ${path}`;
  
  const result = await bash.exec(cmd);
  const lines = result.stdout.trim().split('\n').filter(l => l.length > 0);
  
  // Apply limit if specified
  const limitedLines = options?.limit ? lines.slice(0, options.limit) : lines;
  
  return {
    output: limitedLines.join('\n'),
    matchCount: limitedLines.length,
  };
}

/**
 * Find files by pattern using just-bash's find command
 */
export async function findTool(
  pattern: string,
  path: string = '.',
  options?: {
    limit?: number;
  }
): Promise<{ files: string[] }> {
  const bash = getBash();
  
  // Use find with -name pattern
  let cmd = `find ${path} -name '${pattern}'`;
  if (options?.limit) {
    cmd += ` | head -n ${options.limit}`;
  }
  
  const result = await bash.exec(cmd);
  const files = result.stdout.trim().split('\n').filter(f => f.length > 0);
  
  return { files };
}

/**
 * Read file contents using just-bash's cat command
 */
export async function readTool(
  filePath: string,
  options?: {
    offset?: number;  // line offset
    limit?: number;   // max lines
  }
): Promise<{ content: string }> {
  const bash = getBash();
  
  let cmd = `cat ${filePath}`;
  if (options?.offset || options?.limit) {
    const start = (options?.offset ?? 0) + 1;
    if (options?.limit) {
      const end = start + options.limit - 1;
      cmd = `sed -n '${start},${end}p' ${filePath}`;
    } else {
      cmd = `tail -n +${start} ${filePath}`;
    }
  }
  
  const result = await bash.exec(cmd);
  return { content: result.stdout };
}

/**
 * Write file contents
 */
export async function writeTool(
  filePath: string,
  content: string
): Promise<{ success: boolean }> {
  const bash = getBash();
  
  // Ensure parent directory exists
  const dir = filePath.split('/').slice(0, -1).join('/');
  if (dir) {
    await bash.exec(`mkdir -p ${dir}`);
  }
  
  // Write using heredoc - escape any EOFILE in content
  const escaped = content.replace(/^EOFILE$/gm, 'EOFILE_ESCAPED');
  const result = await bash.exec(`cat > ${filePath} << 'EOFILE'\n${escaped}\nEOFILE`);
  
  return { success: result.exitCode === 0 };
}

/**
 * List directory contents using just-bash's ls command
 */
export async function lsTool(
  path: string = '.',
  options?: {
    long?: boolean;
    all?: boolean;
  }
): Promise<{ output: string; entries: string[] }> {
  const bash = getBash();
  
  let cmd = 'ls';
  if (options?.long) cmd += ' -l';
  if (options?.all) cmd += ' -a';
  cmd += ` ${path}`;
  
  const result = await bash.exec(cmd);
  const entries = result.stdout.trim().split('\n').filter(e => e.length > 0);
  
  return {
    output: result.stdout,
    entries,
  };
}

/**
 * Get bash instance for direct manipulation
 */
export function getFilesystem(): Bash {
  return getBash();
}

/**
 * Reset the bash environment (for testing)
 */
export function resetBash(): void {
  bashInstance = null;
}
