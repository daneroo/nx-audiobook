# Install just on Ubuntu:
# curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | sudo bash -s -- --to /usr/local/bin/

# weird escape for Just, could not get octal 33 any other way
green := `printf "\033[32m"`
red := `printf "\033[31m"`
reset := `printf "\033[0m"`
green_check := green + "✓" + reset
red_xmark := red + "✗" + reset

# List available commands
default:
    just -l

ci:
    pnpm run build
    pnpm run lint
    pnpm run test

# Main target to check files in given directories
checkfiles:
    just checkfiles-in-dir /Volumes/Reading/audiobooks
    just checkfiles-in-dir {{justfile_directory()}}/infra/audiobookshelf/data/audiobooks

# Run checks for a given directory, and if issues are found, ask for confirmation to fix
[private]
checkfiles-in-dir dir:
    #!/usr/bin/env bash
    echo "# Validating {{ dir }}..." | gum format
    just check-ds-store {{ dir }}
    just check-perms {{ dir }}
    just check-xattrs {{ dir }}

# Check or remove .DS_Store files
[private]
check-ds-store dir:
    #!/usr/bin/env bash
    echo "## Checking .DS_Store files" | gum format
    found=$(find {{ dir }} -name .DS_Store)
    if [[ $found ]]; then
        echo "{{ red_xmark }} - Found .DS_Store files:" | gum format
        echo "$found"
        if gum confirm "Do you want to remove them?"; then
          echo "## Removing .DS_Store files in {{ dir }}..." | gum format
          find {{ dir }} -name .DS_Store -delete
        fi
    else
        echo "{{ green_check }} No .DS_Store files found"
    fi

# Check or fix permissions for files and directories
[private]
check-perms dir:
    #!/usr/bin/env bash
    echo "## Checking permissions files/dirs:755/644" | gum format

    files_wrong_perms=$(find {{ dir }} -not -perm 644 -type f)
    dirs_wrong_perms=$(find {{ dir }} -not -perm 755 -type d)

    if [[ $files_wrong_perms ]] || [[ $dirs_wrong_perms ]]; then
        echo "{{ red_xmark }} - Files/directories with incorrect permissions found:" | gum format
        if [[ $files_wrong_perms ]]; then
            echo "Files not having 644 permissions:"
            echo "$files_wrong_perms"
        fi
        if [[ $dirs_wrong_perms ]]; then
            echo "Directories not having 755 permissions:"
            echo "$dirs_wrong_perms"
        fi
        if gum confirm "Do you want to fix the permissions?"; then
            echo "## Fixing permissions in {{ dir }}..." | gum format
            find {{ dir }} -type d -exec chmod 755 {} \;
            find {{ dir }} -type f -exec chmod 644 {} \;
        fi
    else
        echo "{{ green_check }} All file and directory permissions are correct in {{ dir }}."
    fi

# Check or remove extended attributes from files
[private]
check-xattrs dir:
    #!/usr/bin/env bash
    echo "## Checking extended attributes in {{ dir }}..." | gum format
    ANY_XATTRS_FOUND="NONE"  # Initialize the variable outside the loop

    while read -r file; do
        # echo "ANY_XATTRS_FOUND: $ANY_XATTRS_FOUND"
        attrs=$(xattr "$file")
        if [[ $attrs ]]; then
            ANY_XATTRS_FOUND="SOME"
            echo "{{ red_xmark }} $file has xattrs:" | gum format
            echo "$attrs"
            if gum confirm "Do you want to remove the xattrs from this file?"; then
                echo "Removing xattrs from $file"
                xattr -c "$file"
            fi
        fi
    done < <(find {{ dir }} -type f)
    if [ "$ANY_XATTRS_FOUND" == "NONE" ]; then
        echo "{{ green_check }} No files with extended attributes found in {{ dir }}."
    else
        echo "{{ red_xmark }} Some files with extended attributes were found in {{ dir }}."
    fi
