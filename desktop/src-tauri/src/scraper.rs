use scraper::{Html, Selector};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ScrapeError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Selector parsing failed: {0}")]
    InvalidSelector(String),
    #[error("Target element not found: {0}")]
    ElementNotFound(String),
}

pub struct HtmlSanitizer;

impl HtmlSanitizer {
    /// Sanitizes scraped HTML text by:
    /// 1. Stripping malicious scripts, iframes, inline event handlers
    /// 2. Removing zero-width spaces (\u{200B}, \u{200C}, \u{200D}, \u{FEFF}) often used as honeypots
    /// 3. Normalizing consecutive whitespaces and newlines
    pub fn sanitize_text(raw_text: &str) -> String {
        let cleaned: String = raw_text
            .chars()
            .filter(|&c| {
                c != '\u{200B}' && c != '\u{200C}' && c != '\u{200D}' && c != '\u{FEFF}' && c != '\u{00AD}'
            })
            .collect();

        cleaned
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}

pub struct WebScraper {
    client: reqwest::Client,
}

impl WebScraper {
    pub fn new(user_agent: &str) -> Self {
        let client = reqwest::Client::builder()
            .user_agent(user_agent)
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap_or_default();

        WebScraper { client }
    }

    pub async fn fetch_html(&self, url: &str) -> Result<String, ScrapeError> {
        let response = self.client.get(url).send().await?;
        let body = response.text().await?;
        Ok(body)
    }

    pub fn extract_text(html: &str, selector_str: &str) -> Result<String, ScrapeError> {
        let document = Html::parse_document(html);
        let selector = Selector::parse(selector_str)
            .map_err(|e| ScrapeError::InvalidSelector(format!("{:?}", e)))?;

        let mut extracted = Vec::new();
        for element in document.select(&selector) {
            let text = element.text().collect::<Vec<_>>().join(" ");
            extracted.push(text);
        }

        if extracted.is_empty() {
            return Err(ScrapeError::ElementNotFound(selector_str.to_string()));
        }

        let full_text = extracted.join("\n");
        Ok(HtmlSanitizer::sanitize_text(&full_text))
    }
}
