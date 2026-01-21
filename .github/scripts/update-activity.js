const https = require('https');
const fs = require('fs');
const path = require('path');

const USERNAME = 'sammy200-ui';
const MAX_ACTIVITIES = 5;

// Event type to emoji mapping
const eventEmojis = {
    IssueCommentEvent: '🗣',
    IssuesEvent: { opened: '🎉', closed: '❌', reopened: '🔄' },
    PullRequestEvent: { opened: '💪', closed: '🔀', merged: '🎊' },
    PullRequestReviewEvent: '👀',
    PullRequestReviewCommentEvent: '💬',
    WatchEvent: '⭐',
    ForkEvent: '🍴',
    CreateEvent: '🆕',
    DeleteEvent: '🗑️',
    PushEvent: '📌',
    ReleaseEvent: '🚀',
};

// Skip these event types (personal repo pushes, etc.)
const skipEvents = ['PushEvent', 'CreateEvent', 'DeleteEvent'];

function fetchEvents() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/users/${USERNAME}/events/public?per_page=100`,
            headers: {
                'User-Agent': 'GitHub-Activity-Readme',
                'Accept': 'application/vnd.github.v3+json',
            },
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function formatEvent(event) {
    const { type, repo, payload, created_at } = event;
    const repoName = repo.name;
    const repoUrl = `https://github.com/${repoName}`;

    switch (type) {
        case 'IssueCommentEvent': {
            const issue = payload.issue;
            const issueUrl = payload.comment.html_url;
            return `🗣 Commented on [#${issue.number}](${issueUrl}) in [${repoName}](${repoUrl})`;
        }
        case 'IssuesEvent': {
            const issue = payload.issue;
            const action = payload.action;
            const emoji = eventEmojis.IssuesEvent[action] || '🎯';
            const actionText = action.charAt(0).toUpperCase() + action.slice(1);
            return `${emoji} ${actionText} issue [#${issue.number}](${issue.html_url}) in [${repoName}](${repoUrl})`;
        }
        case 'PullRequestEvent': {
            const pr = payload.pull_request;
            const action = payload.action;
            const merged = pr.merged;
            let emoji, actionText;

            if (merged) {
                emoji = '🎊';
                actionText = 'Merged';
            } else if (action === 'opened') {
                emoji = '💪';
                actionText = 'Opened';
            } else if (action === 'closed') {
                emoji = '❌';
                actionText = 'Closed';
            } else {
                emoji = '🔀';
                actionText = action.charAt(0).toUpperCase() + action.slice(1);
            }
            return `${emoji} ${actionText} PR [#${pr.number}](${pr.html_url}) in [${repoName}](${repoUrl})`;
        }
        case 'PullRequestReviewEvent': {
            const pr = payload.pull_request;
            return `👀 Reviewed [#${pr.number}](${pr.html_url}) in [${repoName}](${repoUrl})`;
        }
        case 'PullRequestReviewCommentEvent': {
            const pr = payload.pull_request;
            const commentUrl = payload.comment.html_url;
            return `💬 Commented on PR [#${pr.number}](${commentUrl}) in [${repoName}](${repoUrl})`;
        }
        case 'WatchEvent': {
            return `⭐ Starred [${repoName}](${repoUrl})`;
        }
        case 'ForkEvent': {
            return `🍴 Forked [${repoName}](${repoUrl})`;
        }
        case 'ReleaseEvent': {
            const release = payload.release;
            return `🚀 Released [${release.tag_name}](${release.html_url}) in [${repoName}](${repoUrl})`;
        }
        default:
            return null;
    }
}

async function main() {
    try {
        console.log('Fetching GitHub events...');
        const events = await fetchEvents();

        // Filter out unwanted events and user's own profile repo pushes
        const filteredEvents = events.filter((event) => {
            // Skip push events to own repos
            if (skipEvents.includes(event.type)) return false;
            // Skip events on profile repo
            if (event.repo.name === `${USERNAME}/${USERNAME}`) return false;
            return true;
        });

        // Format events and take top N
        const activities = [];
        const seen = new Set(); // Avoid duplicates

        for (const event of filteredEvents) {
            const formatted = formatEvent(event);
            if (formatted && !seen.has(formatted)) {
                seen.add(formatted);
                activities.push(formatted);
                if (activities.length >= MAX_ACTIVITIES) break;
            }
        }

        if (activities.length === 0) {
            activities.push('🎉 No recent public activity - but trust me, something\'s cooking!');
        }

        // Create the activity section
        const activitySection = activities
            .map((activity, index) => `${index + 1}. ${activity}`)
            .join('\n');

        console.log('Generated activities:');
        console.log(activitySection);

        // Update README
        const readmePath = path.join(process.cwd(), 'README.md');
        let readme = fs.readFileSync(readmePath, 'utf-8');

        const startMarker = '<!--START_SECTION:activity-->';
        const endMarker = '<!--END_SECTION:activity-->';

        const startIndex = readme.indexOf(startMarker);
        const endIndex = readme.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            console.error('Could not find activity section markers in README');
            process.exit(1);
        }

        const newReadme =
            readme.substring(0, startIndex + startMarker.length) +
            '\n' +
            activitySection +
            '\n' +
            readme.substring(endIndex);

        if (newReadme !== readme) {
            fs.writeFileSync(readmePath, newReadme);
            console.log('README updated successfully!');
        } else {
            console.log('No changes to README');
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
