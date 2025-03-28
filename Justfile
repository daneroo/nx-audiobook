# Install just on Ubuntu:
# curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | sudo bash -s -- --to /usr/local/bin/
# Install just on macOS:
# brew install just

# weird escape for Just, could not get octal 33 any other way
green := `printf "\033[32m"`
red := `printf "\033[31m"`
reset := `printf "\033[0m"`
green_check := green + "✔" + reset
red_xmark := red + "✗" + reset
# centralize the format command to style (theme=light)
# theme is managed in ~/.bashrc as dark, unless $TERM_PROGRAM=Apple_Terminal
gum_fmt_cmd := "gum format"

# List available commands
default:
    just -l

ci:
    pnpm run build
    pnpm run lint
    pnpm run test

# Open my working directories
open-working-dirs:
    #!/usr/bin/env bash
    # open the content directory in a new window
    osascript -e 'tell application "Finder" to make new Finder window to folder (POSIX file "'"{{justfile_directory()}}/infra/audiobookshelf/data/audiobooks"'")'
    # open the Staging directory and force a new window
    osascript -e 'tell application "Finder" to make new Finder window to folder (POSIX file "/Volumes/Space/Staging")'

# Main target to check files in given directories
checkfiles:
    just checkfiles-in-dir /Volumes/Space/Staging
    just checkfiles-in-dir /Volumes/Space/Reading/audiobooks
    just checkfiles-in-dir {{justfile_directory()}}/infra/audiobookshelf/data/audiobooks

# Run checks for a given directory, and if issues are found, ask for confirmation to fix
[private]
checkfiles-in-dir dir:
    #!/usr/bin/env bash
    echo "# Validating {{ dir }}..." | {{ gum_fmt_cmd }}
    just check-ds-store {{ dir }}
    just check-perms {{ dir }}
    just check-xattrs {{ dir }}

# Check or remove .DS_Store files
[private]
check-ds-store dir:
    #!/usr/bin/env bash
    echo "## Checking .DS_Store files" | {{ gum_fmt_cmd }}
    found=$(find {{ dir }} -name .DS_Store)
    if [[ $found ]]; then
        echo "{{ red_xmark }} - Found .DS_Store files:"
        echo "$found"
        if gum confirm "Do you want to remove them?"; then
          echo "## Removing .DS_Store files in {{ dir }}..." | {{ gum_fmt_cmd }}
          find {{ dir }} -name .DS_Store -delete
        fi
    else
        echo "{{ green_check }} No .DS_Store files found"
    fi

# Check or fix permissions for files and directories
[private]
check-perms dir:
    #!/usr/bin/env bash
    echo "## Checking permissions files/dirs:755/644" | {{ gum_fmt_cmd }}

    files_wrong_perms=$(find {{ dir }} -not -perm 644 -type f)
    dirs_wrong_perms=$(find {{ dir }} -not -perm 755 -type d)

    if [[ $files_wrong_perms ]] || [[ $dirs_wrong_perms ]]; then
        echo "{{ red_xmark }} - Files/directories with incorrect permissions found:"
        if [[ $files_wrong_perms ]]; then
            echo "Files not having 644 permissions:"
            echo "$files_wrong_perms"
        fi
        if [[ $dirs_wrong_perms ]]; then
            echo "Directories not having 755 permissions:"
            echo "$dirs_wrong_perms"
        fi
        if gum confirm "Do you want to fix the permissions?"; then
            echo "## Fixing permissions in {{ dir }}..." | {{ gum_fmt_cmd }}
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
    echo "## Checking extended attributes in {{ dir }}..." | {{ gum_fmt_cmd }}

    ANY_REMOVEABLE_XATTRS_FOUND="NONE"  # Initialize the variable outside the loop

    while read -r file; do
        # echo "ANY_XATTRS_FOUND: $ANY_XATTRS_FOUND"
        attrs=$(xattr "$file")
        if [[ $attrs ]]; then
            # Special case for com.apple.provenance
            if [[ "$attrs" == "com.apple.provenance" ]]; then
                echo "{{ red_xmark }} $(basename "$file") has com.apple.provenance xattr (cannot be removed on newer macOS)"
                continue
            fi

            ANY_REMOVEABLE_XATTRS_FOUND="SOME"
            echo "===== Removing xattrs from $file ======"
            echo "{{ red_xmark }} $(basename "$file") has xattrs:"
            echo "$attrs"
            xattr -c "$file"

            # Check if removal was successful
            remaining_attrs=$(xattr "$file")
            if [[ $remaining_attrs ]]; then
                echo "{{ red_xmark }} Failed to remove xattrs"
                echo "Remaining attrs:"
                echo "xattr output: '$remaining_attrs'"
                # echo "xattr -l output:"
                # xattr -l "$file"
                # echo "Try performing it from the shell"
                # echo "xattr -c \"$file\""
            else
                echo "{{ green_check }} Successfully removed xattrs"
            fi
        fi
    done < <(find {{ dir }} -type f)
    echo "" # new line
    if [ "$ANY_REMOVEABLE_XATTRS_FOUND" == "NONE" ]; then
        echo "{{ green_check }} No files with removable extended attributes found in {{ dir }}."
    else
        echo "{{ red_xmark }} Some files with removable extended attributes were found in {{ dir }}."
    fi
