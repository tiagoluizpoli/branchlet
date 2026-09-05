import { describe, expect, test } from "bun:test"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import {
  getRepositoryBaseName,
  getRepositoryRoot,
  getWorktreePath,
  resolveTemplate,
  validateBranchName,
  validateDirectoryName,
} from "../../src/utils/path-utils.js"
import type { TemplateVariables } from "../../src/types/index.js"

describe("path-utils", () => {
  describe("getRepositoryRoot", () => {
    test("should return current working directory", () => {
      const result = getRepositoryRoot()
      expect(result).toBeDefined()
      expect(typeof result).toBe("string")
    })

    test("should resolve provided path", () => {
      const testPath = "/test/path"
      const result = getRepositoryRoot(testPath)
      expect(result).toBe(testPath)
    })
  })

  describe("getRepositoryBaseName", () => {
    test("should extract repository base name", () => {
      const repoPath = "/path/to/my-project"
      const result = getRepositoryBaseName(repoPath)
      expect(result).toBe("my-project")
    })

    test("should handle root path", () => {
      const repoPath = "/"
      const result = getRepositoryBaseName(repoPath)
      expect(result).toBe("")
    })

    test("should handle relative paths", () => {
      const repoPath = "my-project"
      const result = getRepositoryBaseName(repoPath)
      expect(result).toBe("my-project")
    })
  })

  describe("resolveTemplate", () => {
    const mockVariables: TemplateVariables = {
      BASE_PATH: "my-project",
      WORKTREE_PATH: "/path/to/worktree",
      BRANCH_NAME: "feature/awesome",
      SOURCE_BRANCH: "main",
    }

    test("should resolve all template variables", () => {
      const template = "$BASE_PATH-worktrees/$BRANCH_NAME-from-$SOURCE_BRANCH"
      const expected = "my-project-worktrees/feature/awesome-from-main"

      const result = resolveTemplate(template, mockVariables)
      expect(result).toBe(expected)
    })

    test("should handle template with no variables", () => {
      const template = "static/path/to/worktrees"
      const result = resolveTemplate(template, mockVariables)
      expect(result).toBe(template)
    })

    test("should handle template with only one variable", () => {
      const template = "worktrees/$BRANCH_NAME"
      const expected = "worktrees/feature/awesome"

      const result = resolveTemplate(template, mockVariables)
      expect(result).toBe(expected)
    })

    test("should handle repeated variables", () => {
      const template = "$BRANCH_NAME-$BRANCH_NAME-test"
      const expected = "feature/awesome-feature/awesome-test"

      const result = resolveTemplate(template, mockVariables)
      expect(result).toBe(expected)
    })

    test("should handle missing variables in template", () => {
      const template = "$BASE_PATH/$UNKNOWN_VAR/$BRANCH_NAME"
      const expected = "my-project/$UNKNOWN_VAR/feature/awesome"

      const result = resolveTemplate(template, mockVariables)
      expect(result).toBe(expected)
    })

    test("should handle empty template", () => {
      const result = resolveTemplate("", mockVariables)
      expect(result).toBe("")
    })
  })

  describe("validateBranchName", () => {
    test("should accept valid branch names", () => {
      const validNames = [
        "main",
        "develop",
        "feature/awesome-feature",
        "bug-fix",
        "release/v1.0.0",
        "feat/user-auth_system",
      ]

      for (const name of validNames) {
        expect(validateBranchName(name)).toBeUndefined()
      }
    })

    test("should reject invalid branch names", () => {
      const invalidNames = [
        "", // empty
        " ", // whitespace only
        "feature ", // trailing space
        " feature", // leading space
        "feat ure", // internal space
        "feature.", // ends with dot
        "feature/", // ends with slash
        "/feature", // starts with slash
        "feature//fix", // double slash
        "feature..fix", // double dot
        "-feature", // starts with dash
        "feature~", // contains tilde
        "feature^", // contains caret
        "feature:", // contains colon
        "feature?", // contains question mark
        "feature*", // contains asterisk
        "feature[", // contains bracket
        "feature\\", // contains backslash
      ]

      for (const name of invalidNames) {
        expect(validateBranchName(name)).toBeDefined()
      }
    })

    test("should reject HEAD as branch name", () => {
      expect(validateBranchName("HEAD")).toBeDefined()
    })
  })

  describe("validateDirectoryName", () => {
    test("should accept valid directory names", () => {
      const validNames = [
        "test",
        "my-directory",
        "dir_with_underscores",
        "dir123",
        "CamelCase",
        "mixed-Case_123",
      ]

      for (const name of validNames) {
        expect(validateDirectoryName(name)).toBeUndefined()
      }
    })

    test("should reject invalid directory names", () => {
      const invalidNames = [
        "", // empty
        "   ", // whitespace only
        "dir/name", // contains slash
        "dir\\name", // contains backslash
        ".hidden", // starts with dot
        "-dash", // starts with dash
        "dir<name", // contains invalid char
        "dir>name", // contains invalid char
        "dir:name", // contains invalid char
        "dir|name", // contains invalid char
        "dir?name", // contains invalid char
        "dir*name", // contains invalid char
      ]

      for (const name of invalidNames) {
        expect(validateDirectoryName(name)).toBeDefined()
      }
    })

    test("should reject very long directory names", () => {
      const longName = "a".repeat(256)
      expect(validateDirectoryName(longName)).toBeDefined()
    })

    test("should accept directory names at length limit", () => {
      const maxLengthName = "a".repeat(255)
      expect(validateDirectoryName(maxLengthName)).toBeUndefined()
    })
  })

  describe("getWorktreePath", () => {
    test("uses a home-relative template as the worktree base", () => {
      const result = getWorktreePath(
        "/projects/branchlet",
        "feature-worktree",
        "~/worktrees/$BRANCH_NAME",
        "feature/login"
      )

      expect(result).toBe(join(homedir(), "worktrees", "feature", "login", "feature-worktree"))
      expect(getWorktreePath("/projects/branchlet", "feature-worktree", "~")).toBe(
        join(homedir(), "feature-worktree")
      )
    })

    test("uses a native absolute template as the worktree base", () => {
      const template = join(process.cwd(), "shared-worktrees")

      const result = getWorktreePath("/projects/branchlet", "feature-worktree", template)

      expect(result).toBe(join(template, "feature-worktree"))
    })

    test("keeps ordinary-relative and parent-segment templates relative to the repository parent", () => {
      const gitRoot = join(process.cwd(), "projects", "branchlet")
      const parentDir = dirname(gitRoot)

      expect(getWorktreePath(gitRoot, "feature-worktree", "worktrees")).toBe(
        join(parentDir, "worktrees", "feature-worktree")
      )
      expect(getWorktreePath(gitRoot, "feature-worktree", "../shared-worktrees")).toBe(
        join(parentDir, "../shared-worktrees", "feature-worktree")
      )
    })

    test("keeps unsupported tilde forms as ordinary-relative templates", () => {
      const gitRoot = join(process.cwd(), "projects", "branchlet")
      const parentDir = dirname(gitRoot)
      const unsupportedTemplates = ["~user/worktrees", "~~/worktrees", "~\\worktrees"]

      for (const template of unsupportedTemplates) {
        expect(getWorktreePath(gitRoot, "feature-worktree", template)).toBe(
          join(parentDir, template, "feature-worktree")
        )
      }
    })

    if (process.platform === "win32") {
      test("uses drive-rooted and UNC templates as worktree bases on Windows", () => {
        expect(getWorktreePath("C:\\projects\\branchlet", "feature-worktree", "D:\\worktrees")).toBe(
          join("D:\\worktrees", "feature-worktree")
        )
        expect(
          getWorktreePath("C:\\projects\\branchlet", "feature-worktree", "\\\\server\\share\\worktrees")
        ).toBe(join("\\\\server\\share\\worktrees", "feature-worktree"))
      })
    }

    test("should generate worktree path using template", () => {
      const gitRoot = "/Users/test/my-project"
      const directoryName = "feature-branch"
      const template = "$BASE_PATH-worktrees/$BRANCH_NAME"
      const branchName = "feature/awesome"
      const sourceBranch = "main"

      const result = getWorktreePath(gitRoot, directoryName, template, branchName, sourceBranch)
      
      expect(result).toContain("my-project-worktrees/feature/awesome")
      expect(result).toContain("feature-branch")
    })

    test("should handle template without variables", () => {
      const gitRoot = "/Users/test/my-project"
      const directoryName = "test-dir"
      const template = "static-worktrees"
      
      const result = getWorktreePath(gitRoot, directoryName, template)
      
      expect(result).toContain("static-worktrees")
      expect(result).toContain("test-dir")
    })

    test("should handle missing branch parameters", () => {
      const gitRoot = "/Users/test/my-project"
      const directoryName = "test-dir"
      const template = "$BASE_PATH/$BRANCH_NAME"
      
      const result = getWorktreePath(gitRoot, directoryName, template)
      
      expect(result).toContain("my-project")
      expect(result).toContain("test-dir")
    })

    test("should handle complex template with all variables", () => {
      const gitRoot = "/repo/awesome-project"
      const directoryName = "work-dir"
      const template = "$BASE_PATH-$SOURCE_BRANCH-to-$BRANCH_NAME"
      const branchName = "feature/new-feature"
      const sourceBranch = "develop"

      const result = getWorktreePath(gitRoot, directoryName, template, branchName, sourceBranch)
      
      expect(result).toContain("awesome-project-develop-to-feature/new-feature")
      expect(result).toContain("work-dir")
    })

    test("should handle root directory git repository", () => {
      const gitRoot = "/"
      const directoryName = "test"
      const template = "$BASE_PATH-worktrees"
      
      const result = getWorktreePath(gitRoot, directoryName, template)
      
      expect(result).toBeDefined()
      expect(result).toContain("test")
    })

    test("should handle relative paths", () => {
      const gitRoot = "my-project"
      const directoryName = "new-work"
      const template = "$BASE_PATH-branches"
      
      const result = getWorktreePath(gitRoot, directoryName, template)
      
      expect(result).toContain("my-project-branches")
      expect(result).toContain("new-work")
    })
  })
})
