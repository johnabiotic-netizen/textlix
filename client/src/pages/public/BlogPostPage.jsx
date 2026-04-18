import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiArrowLeft, FiClock, FiCalendar } from 'react-icons/fi';
import PublicLayout from '../../components/layout/PublicLayout';
import { POSTS } from './BlogPage';
import BlogHeroImage from '../../components/blog/BlogHeroImage';

function renderContent(content) {
  const lines = content.trim().split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="font-display font-bold text-xl text-gray-900 mt-10 mb-4">
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-display font-semibold text-lg text-gray-800 mt-8 mb-3">
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // Inline image: ![alt](url)
    if (line.startsWith('![')) {
      const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (match) {
        elements.push(
          <figure key={i} className="my-8">
            <img
              src={match[2]}
              alt={match[1]}
              className="w-full rounded-2xl object-cover shadow-sm"
              style={{ maxHeight: '420px' }}
              loading="lazy"
            />
            {match[1] && (
              <figcaption className="text-center text-xs text-gray-400 mt-2">{match[1]}</figcaption>
            )}
          </figure>
        );
      }
      i++;
      continue;
    }

    // Callout / blockquote: > text
    if (line.startsWith('> ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-brand-400 bg-brand-50 rounded-r-xl px-5 py-4 my-6 italic text-gray-700">
          {items.map((item, idx) => (
            <p key={idx} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} className="mb-1 last:mb-0" />
          ))}
        </blockquote>
      );
      continue;
    }

    // Table: detect header row
    if (line.startsWith('|') && lines[i + 1]?.startsWith('|--')) {
      const headers = line.split('|').filter((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i].split('|').filter((c) => c.trim()));
        i++;
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-6">
          <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-gray-600 border-b border-gray-100" dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Ordered list block
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-outside ml-5 space-y-2 my-4 text-gray-600">
          {items.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list block
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-outside ml-5 space-y-2 my-4 text-gray-600">
          {items.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      continue;
    }

    // Bold label block (e.g. "**Step 1 — ...**")
    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-semibold text-gray-900 mt-6 mb-1"
          dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
      i++;
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-gray-600 leading-relaxed my-3"
        dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
    i++;
  }

  return elements;
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:text-brand-700 underline underline-offset-2 font-medium">$1</a>');
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = POSTS.find((p) => p.slug === slug);

  if (!post) return <Navigate to="/blog" replace />;

  const currentIndex = POSTS.indexOf(post);
  const prevPost = POSTS[currentIndex - 1] ?? null;
  const nextPost = POSTS[currentIndex + 1] ?? null;

  return (
    <PublicLayout>
      <Helmet>
        <title>{post.title} — TextLix Blog</title>
        <meta name="description" content={post.description} />
        <link rel="canonical" href={`https://www.textlix.com/blog/${post.slug}`} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:url" content={`https://www.textlix.com/blog/${post.slug}`} />
        <meta property="og:type" content="article" />
        {post.image && <meta property="og:image" content={post.image} />}
        <meta property="article:published_time" content={post.date} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          image: post.image,
          author: { '@type': 'Organization', name: 'TextLix' },
          publisher: { '@type': 'Organization', name: 'TextLix', url: 'https://www.textlix.com' },
          url: `https://www.textlix.com/blog/${post.slug}`,
        })}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back */}
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 mb-8 transition-colors">
          <FiArrowLeft size={14} /> Back to Blog
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full">{post.category}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400"><FiClock size={12} /> {post.readTime}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <FiCalendar size={12} />
            {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display font-extrabold text-3xl md:text-4xl text-gray-900 mb-4 leading-tight">
          {post.title}
        </h1>
        <p className="text-lg text-gray-500 mb-8 leading-relaxed">
          {post.description}
        </p>

        {/* Hero image */}
        <div className="rounded-2xl overflow-hidden mb-10 shadow-sm">
          <BlogHeroImage slug={post.slug} style={{ height: '380px' }} />
        </div>

        <div className="border-b border-gray-100 mb-10" />

        {/* Content */}
        <div className="text-base">
          {renderContent(post.content)}
        </div>

        {/* Post nav */}
        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-6">
          {prevPost ? (
            <Link to={`/blog/${prevPost.slug}`} className="group flex-1">
              <p className="text-xs text-gray-400 mb-1">← Previous</p>
              <p className="text-sm font-medium text-gray-700 group-hover:text-brand-600 transition-colors">{prevPost.title}</p>
            </Link>
          ) : <div className="flex-1" />}
          {nextPost ? (
            <Link to={`/blog/${nextPost.slug}`} className="group flex-1 text-right">
              <p className="text-xs text-gray-400 mb-1">Next →</p>
              <p className="text-sm font-medium text-gray-700 group-hover:text-brand-600 transition-colors">{nextPost.title}</p>
            </Link>
          ) : <div className="flex-1" />}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-br from-brand-600 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h2 className="font-display font-bold text-xl mb-2">Ready to try TextLix?</h2>
          <p className="text-brand-100 text-sm mb-6">Virtual phone numbers from 150+ countries. Codes delivered in seconds.</p>
          <Link to="/register" className="bg-white text-brand-600 font-semibold px-6 py-2.5 rounded-xl hover:bg-brand-50 transition-colors inline-block text-sm">
            Create Free Account
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
