const https = require('https');
const fs = require('fs');
const path = require('path');

const USERNAME = 'sammy200-ui';
const MAX_ACTIVITIES = 5;

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
    const { type, repo, payload } = event;
    const repoName = repo.name;
    const repoUrl = `https://github.com/${repoName}`;

    switch (type) {
        case 'IssueCommentEvent': {
            const issue = payload.issue;
            const issueUrl = payload.comment.html_url;
            return `Commented on [#${issue.number}](${issueUrl}) in [${repoName}](${repoUrl})`;
        }
        case 'IssuesEvent': {
            const issue = payload.issue;
            const action = payload.action.charAt(0).toUpperCase() + payload.action.slice(1);
            return `${action} issue [#${issue.number}](${issue.html_url}) in [${repoName}](${repoUrl})`;
        }
        case 'PullRequestEvent': {
            const pr = payload.pull_request;
            const action = pr.merged ? 'Merged' : payload.action.charAt(0).toUpperCase() + payload.action.slice(1);
            return `${action} PR [#${pr.number}](${pr.html_url}) in [${repoName}](${repoUrl})`;
        }
        case 'PullRequestReviewEvent': {
            const pr = payload.pull_request;
            return `Reviewed [#${pr.number}](${pr.html_url}) in [${repoName}](${repoUrl})`;
        }
        case 'PullRequestReviewCommentEvent': {
            const pr = payload.pull_request;
            const commentUrl = payload.comment.html_url;
            return `Commented on PR [#${pr.number}](${commentUrl}) in [${repoName}](${repoUrl})`;
        }
        case 'WatchEvent': {
            return `Starred [${repoName}](${repoUrl})`;
        }
        case 'ForkEvent': {
            return `Forked [${repoName}](${repoUrl})`;
        }
        case 'ReleaseEvent': {
            const release = payload.release;
            return `Released [${release.tag_name}](${release.html_url}) in [${repoName}](${repoUrl})`;
        }
        default:
            return null;
    }
}

async function main() {
    const events = await fetchEvents();

    const filteredEvents = events.filter((event) => {
        if (skipEvents.includes(event.type)) return false;
        if (event.repo.name === `${USERNAME}/${USERNAME}`) return false;
        return true;
    });

    const activities = [];
    const seen = new Set();

    for (const event of filteredEvents) {
        const formatted = formatEvent(event);
        if (formatted && !seen.has(formatted)) {
            seen.add(formatted);
            activities.push(formatted);
            if (activities.length >= MAX_ACTIVITIES) break;
        }
    }

    if (activities.length === 0) {
        activities.push('No recent public activity');
    }

    const activitySection = activities
        .map((activity, index) => `${index + 1}. ${activity}`)
        .join('\n');

    const readmePath = path.join(process.cwd(), 'README.md');
    let readme = fs.readFileSync(readmePath, 'utf-8');

    const startMarker = '<!--START_SECTION:activity-->';
    const endMarker = '<!--END_SECTION:activity-->';

    const startIndex = readme.indexOf(startMarker);
    const endIndex = readme.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
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
    }
}

main();
